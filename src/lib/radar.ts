import { unstable_cache } from "next/cache";

import { getCeapAnalytics, type SourceStatus, type SupplierSummary } from "@/lib/ceap";
import { normalizeSupplierDocument } from "@/lib/suppliers";

const RADAR_REVALIDATE_SECONDS = 12 * 60 * 60;
const RADAR_RECENT_CONTRACT_DAYS = 120;
const RADAR_MAX_SUPPLIERS = 120;
const RADAR_ALERT_LIMIT = 24;
const PNCP_MAX_PAGES = 6;
const PNCP_PAGE_SIZE = 500;
const RECENT_COMPANY_MAX_DAYS = 730;
const BRASIL_API_CONCURRENCY = 8;
const PNCP_PAGE_CONCURRENCY = 3;
const CEAP_RECURRENCE_MIN_DEPUTIES = 3;
const HIGH_SPEND_ALERT_AMOUNT = 50000;

const BRASIL_API_BASE_URL = "https://brasilapi.com.br/api/cnpj/v1";
const PNCP_CONSULTA_BASE_URL = "https://pncp.gov.br/api/consulta";

type BrasilApiCompany = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  porte?: string;
  natureza_juridica?: string;
  municipio?: string;
  uf?: string;
  capital_social?: number | string;
  data_inicio_atividade?: string;
};

type PncpContract = {
  numeroControlePNCP?: string;
  numeroControlePNCPCompra?: string;
  numeroContratoEmpenho?: string;
  anoContrato?: number;
  sequencialContrato?: number;
  objetoContrato?: string;
  informacaoComplementar?: string;
  niFornecedor?: string;
  nomeRazaoSocialFornecedor?: string;
  valorInicial?: number;
  valorGlobal?: number;
  dataAssinatura?: string;
  dataVigenciaInicio?: string;
  dataVigenciaFim?: string;
  dataPublicacaoPncp?: string;
  dataAtualizacao?: string;
  dataAtualizacaoGlobal?: string;
  orgaoEntidade?: {
    cnpj?: string;
    razaoSocial?: string;
    poderId?: string;
    esferaId?: string;
  };
  unidadeOrgao?: {
    codigoUnidade?: string;
    nomeUnidade?: string;
    municipioNome?: string;
    ufSigla?: string;
  };
};

type PncpContractsResponse = {
  data?: PncpContract[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
  paginasRestantes?: number;
  empty?: boolean;
};

export type RadarReasonCode =
  | "new_company"
  | "ceap_recurrence"
  | "contract_burst"
  | "multi_deputy_multi_body";

export type RadarReason = {
  code: RadarReasonCode;
  label: string;
  description: string;
};

export type RadarContractSnippet = {
  id?: string;
  title: string;
  supplierName?: string;
  publishedAt?: string;
  totalAmount?: number;
  organName?: string;
  organCnpj?: string;
  organUf?: string;
  organCity?: string;
};

export type RadarAlert = {
  supplierId: string;
  supplierHref: string;
  supplierName: string;
  supplierDocument: string;
  ceapTotalAmount: number;
  ceapDeputyCount: number;
  ceapExpenseCount: number;
  topCategory?: string;
  companyOpenedAt?: string;
  companyAgeDays?: number;
  companyOfficialName?: string;
  companyStatus?: string;
  companyCity?: string;
  companyState?: string;
  pncpContractsCount: number;
  publicBodyCount: number;
  riskScore: number;
  riskLevel: "medium" | "high";
  reasons: RadarReason[];
  recentContracts: RadarContractSnippet[];
};

export type ContractsRadar = {
  updatedAt: string;
  windowStart: string;
  windowEnd: string;
  sourceStatus: SourceStatus[];
  totals: {
    analyzedSuppliers: number;
    flaggedSuppliers: number;
    recentCompanies: number;
    matchedContracts: number;
    matchedSuppliers: number;
  };
  alerts: RadarAlert[];
};

type PncpContractsSnapshot = {
  contracts: PncpContract[];
  matchedSuppliers: number;
  pagesFetched: number;
  totalPages: number;
};

function sanitizeJsonText(payload: string) {
  return payload.replace(/^\uFEFF/, "").trimStart();
}

async function fetchJsonPayload(url: string, tags: string[]) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    cache: "force-cache",
    next: {
      revalidate: RADAR_REVALIDATE_SECONDS,
      tags
    }
  });

  if (response.status === 404 || response.status === 204) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${url}: ${response.status}`);
  }

  const rawPayload = sanitizeJsonText(await response.text());

  if (!rawPayload || rawPayload.startsWith("<")) {
    return undefined;
  }

  return JSON.parse(rawPayload) as unknown;
}

function formatDateParam(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function subtractDays(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

function parseDateValue(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const directDate = new Date(trimmed);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const brazilianDateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!brazilianDateMatch) {
    return undefined;
  }

  const [, day, month, year] = brazilianDateMatch;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function differenceInDays(from: Date, to = new Date()) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / millisecondsPerDay);
}

async function fetchBrasilApiCompany(cnpj: string) {
  const payload = await fetchJsonPayload(`${BRASIL_API_BASE_URL}/${cnpj}`, [
    "radar",
    "radar-brasilapi",
    `radar-brasilapi-${cnpj}`
  ]);

  return payload as BrasilApiCompany | undefined;
}

async function mapWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TResult>
) {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const results = new Array<TResult>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function fetchPncpContractsPage(windowStart: string, windowEnd: string, page: number) {
  const url =
    `${PNCP_CONSULTA_BASE_URL}/v1/contratos/atualizacao?` +
    `dataInicial=${windowStart}&dataFinal=${windowEnd}&pagina=${page}&tamanhoPagina=${PNCP_PAGE_SIZE}`;

  const payload = (await fetchJsonPayload(url, [
    "radar",
    "radar-pncp",
    `radar-pncp-${windowStart}-${windowEnd}`
  ])) as PncpContractsResponse | undefined;

  return payload;
}

function getPncpContractKey(contract: PncpContract) {
  return [
    contract.numeroControlePNCP,
    contract.numeroContratoEmpenho,
    contract.orgaoEntidade?.cnpj,
    contract.niFornecedor,
    contract.dataAtualizacaoGlobal ?? contract.dataPublicacaoPncp
  ]
    .filter(Boolean)
    .join(":");
}

async function fetchPncpContractsWindow(
  windowStart: string,
  windowEnd: string,
  watchedSuppliers: Set<string>
): Promise<PncpContractsSnapshot> {
  const firstPage = await fetchPncpContractsPage(windowStart, windowEnd, 1);
  const firstContracts = Array.isArray(firstPage?.data) ? firstPage.data : [];
  const totalPages = Math.max(1, firstPage?.totalPaginas ?? 1);

  if (firstContracts.length === 0) {
    return {
      contracts: [],
      matchedSuppliers: 0,
      pagesFetched: 1,
      totalPages
    };
  }

  const pagesToFetch = Array.from(
    { length: Math.min(PNCP_MAX_PAGES, totalPages) - 1 },
    (_, index) => index + 2
  );
  const remainingPages = await mapWithConcurrency(
    pagesToFetch,
    PNCP_PAGE_CONCURRENCY,
    async (page) => fetchPncpContractsPage(windowStart, windowEnd, page)
  );
  const contracts = [firstPage, ...remainingPages]
    .flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : []))
    .filter((contract, index, collection) => {
      const contractKey = getPncpContractKey(contract);

      return (
        contractKey.length > 0 &&
        collection.findIndex((current) => getPncpContractKey(current) === contractKey) === index
      );
    });
  const matchedSuppliers = new Set(
    contracts
      .map((contract) => normalizeSupplierDocument(contract.niFornecedor))
      .filter((cnpj) => cnpj.length === 14 && watchedSuppliers.has(cnpj))
  ).size;

  return {
    contracts,
    matchedSuppliers,
    pagesFetched: Math.min(PNCP_MAX_PAGES, totalPages),
    totalPages
  };
}

function createPncpIndex(contracts: PncpContract[]) {
  const index = new Map<string, PncpContract[]>();

  for (const contract of contracts) {
    const cnpj = normalizeSupplierDocument(contract.niFornecedor);

    if (cnpj.length !== 14) {
      continue;
    }

    const current = index.get(cnpj) ?? [];
    current.push(contract);
    index.set(cnpj, current);
  }

  return index;
}

function buildBrasilApiStatus(
  checkedAt: string,
  analyzedSuppliers: number,
  resolvedSuppliers: number,
  rejectedSuppliers: number
): SourceStatus {
  return {
    id: "brasilapi-cnpj",
    label: "BrasilAPI CNPJ",
    status: rejectedSuppliers > 0 && resolvedSuppliers === 0 ? "degraded" : "ok",
    sourceUrl: `${BRASIL_API_BASE_URL}/00000000000191`,
    checkedAt,
    updateCadence: "Cache no app a cada 12 horas",
    details:
      analyzedSuppliers === 0
        ? "Nenhum fornecedor CEAP com CNPJ valido entrou no recorte atual."
        : `Enriquecimento de ${resolvedSuppliers}/${analyzedSuppliers} fornecedores com CNPJ valido. ${
            rejectedSuppliers > 0
              ? `${rejectedSuppliers} consulta(s) falharam e foram ignoradas.`
              : "Nenhuma falha de enriquecimento detectada."
          }`
  };
}

function buildPncpStatus(
  checkedAt: string,
  windowStart: string,
  windowEnd: string,
  pagesFetched: number,
  totalPages: number,
  contractsCount: number,
  matchedSuppliers: number,
  error?: string
): SourceStatus {
  return {
    id: "pncp-contratos",
    label: "PNCP contratos",
    status: error ? "degraded" : "ok",
    sourceUrl:
      `${PNCP_CONSULTA_BASE_URL}/v1/contratos/atualizacao?` +
      `dataInicial=${windowStart}&dataFinal=${windowEnd}&pagina=1&tamanhoPagina=${PNCP_PAGE_SIZE}`,
    checkedAt,
    updateCadence: "Cache no app a cada 12 horas",
    details: error
      ? error
      : `Consulta por atualizacao global: ${contractsCount} contrato(s)/empenho(s) recentes em ${pagesFetched}/${totalPages} pagina(s), com ${matchedSuppliers} fornecedor(es) CEAP cruzado(s) por CNPJ.`
  };
}

function buildRadarReasonSet(
  supplier: SupplierSummary,
  companyOpenedAt: Date | undefined,
  matchedContracts: PncpContract[],
  publicBodyCount: number
) {
  const reasons: RadarReason[] = [];

  if (companyOpenedAt) {
    const companyAgeDays = differenceInDays(companyOpenedAt);

    if (companyAgeDays <= RECENT_COMPANY_MAX_DAYS) {
      reasons.push({
        code: "new_company",
        label: "Empresa recente",
        description: `Empresa aberta ha aproximadamente ${companyAgeDays} dias e ja aparece no recorte da CEAP.`
      });
    }
  }

  if (supplier.deputyCount >= CEAP_RECURRENCE_MIN_DEPUTIES) {
    reasons.push({
      code: "ceap_recurrence",
      label: "Recorrencia na CEAP",
      description: `Fornecedor aparece para ${supplier.deputyCount} deputado(s) no recorte atual da CEAP.`
    });
  }

  if (matchedContracts.length === 0) {
    return reasons;
  }

  if (matchedContracts.length >= 3) {
    reasons.push({
      code: "contract_burst",
      label: "Muitos contratos recentes",
      description: `${matchedContracts.length} contratos/empenhos encontrados no PNCP dentro da janela recente.`
    });
  }

  if (supplier.deputyCount >= 2 && publicBodyCount >= 2) {
    reasons.push({
      code: "multi_deputy_multi_body",
      label: "Recorrencia cruzada",
      description: `Fornecedor aparece para ${supplier.deputyCount} deputado(s) na CEAP e ${publicBodyCount} orgao(s) no PNCP.`
    });
  }

  return reasons;
}

function getAlertRiskScore(
  supplier: SupplierSummary,
  companyAgeDays: number | undefined,
  matchedContracts: PncpContract[],
  reasons: RadarReason[]
) {
  return (
    reasons.length +
    (typeof companyAgeDays === "number" && companyAgeDays <= RECENT_COMPANY_MAX_DAYS ? 1 : 0) +
    (matchedContracts.length > 0 ? 1 : 0) +
    (matchedContracts.length >= 5 ? 1 : 0) +
    (supplier.totalAmount >= HIGH_SPEND_ALERT_AMOUNT ? 1 : 0)
  );
}

function getAlertRiskLevel(
  riskScore: number,
  companyAgeDays: number | undefined,
  matchedContracts: PncpContract[]
) {
  if (
    riskScore >= 5 ||
    (matchedContracts.length > 0 &&
      typeof companyAgeDays === "number" &&
      companyAgeDays <= RECENT_COMPANY_MAX_DAYS)
  ) {
    return "high" as const;
  }

  return "medium" as const;
}

function shouldIncludeAlert(
  supplier: SupplierSummary,
  companyAgeDays: number | undefined,
  matchedContracts: PncpContract[],
  reasons: RadarReason[]
) {
  if (reasons.length === 0) {
    return false;
  }

  if (matchedContracts.length > 0) {
    return true;
  }

  if (typeof companyAgeDays === "number" && companyAgeDays <= RECENT_COMPANY_MAX_DAYS) {
    return true;
  }

  return supplier.deputyCount >= CEAP_RECURRENCE_MIN_DEPUTIES;
}

function buildContractSnippet(contract: PncpContract): RadarContractSnippet {
  return {
    id: contract.numeroControlePNCP,
    title: contract.objetoContrato ?? contract.informacaoComplementar ?? "Contrato sem descricao",
    supplierName: contract.nomeRazaoSocialFornecedor,
    publishedAt: contract.dataPublicacaoPncp,
    totalAmount: contract.valorGlobal ?? contract.valorInicial,
    organName: contract.orgaoEntidade?.razaoSocial,
    organCnpj: contract.orgaoEntidade?.cnpj,
    organUf: contract.unidadeOrgao?.ufSigla,
    organCity: contract.unidadeOrgao?.municipioNome
  };
}

function getContractSortValue(contract: PncpContract) {
  const referenceDate =
    contract.dataAtualizacaoGlobal ??
    contract.dataPublicacaoPncp ??
    contract.dataAssinatura ??
    contract.dataAtualizacao ??
    contract.dataVigenciaInicio;

  if (!referenceDate) {
    return 0;
  }

  const parsedDate = new Date(referenceDate).getTime();
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

const getContractsRadarCached = unstable_cache(
  async (): Promise<ContractsRadar> => {
    const checkedAt = new Date().toISOString();
    const windowEndDate = new Date();
    const windowStartDate = subtractDays(RADAR_RECENT_CONTRACT_DAYS);
    const windowStart = formatDateParam(windowStartDate);
    const windowEnd = formatDateParam(windowEndDate);

    const analytics = await getCeapAnalytics();
    const ceapSourceStatus =
      analytics.sourceStatus.find((source) => source.id === "ceap-file") ?? {
        id: "ceap-file",
        label: "CEAP anual da Camara",
        status: "degraded",
        sourceUrl: "https://www.camara.leg.br/cotas/",
        checkedAt,
        updateCadence: "Cache no app a cada 12 horas",
        details: "Camada CEAP nao retornou metadados da fonte."
      };

    const ceapSuppliers = analytics.suppliers
      .filter((supplier) => normalizeSupplierDocument(supplier.document).length === 14)
      .slice(0, RADAR_MAX_SUPPLIERS);
    const watchedSupplierCnpjs = new Set(
      ceapSuppliers.map((supplier) => normalizeSupplierDocument(supplier.document))
    );
    const brasilApiEntries = await mapWithConcurrency(
      ceapSuppliers,
      BRASIL_API_CONCURRENCY,
      async (supplier) => {
        const cnpj = normalizeSupplierDocument(supplier.document);

        try {
          return [cnpj, await fetchBrasilApiCompany(cnpj)] as const;
        } catch {
          return [cnpj, undefined] as const;
        }
      }
    );
    const companiesByCnpj = new Map<string, BrasilApiCompany>();
    let resolvedCompanies = 0;
    let rejectedCompanies = 0;

    for (const [cnpj, company] of brasilApiEntries) {
      if (company) {
        companiesByCnpj.set(cnpj, company);
        resolvedCompanies += 1;
      } else {
        rejectedCompanies += 1;
      }
    }

    let pncpSnapshot: PncpContractsSnapshot = {
      contracts: [],
      matchedSuppliers: 0,
      pagesFetched: 0,
      totalPages: 0
    };
    let pncpErrorDetails: string | undefined;

    try {
      pncpSnapshot = await fetchPncpContractsWindow(windowStart, windowEnd, watchedSupplierCnpjs);
    } catch (error) {
      pncpErrorDetails =
        error instanceof Error
          ? error.message
          : "Falha desconhecida ao consultar contratos recentes do PNCP.";
    }

    const pncpIndex = createPncpIndex(pncpSnapshot.contracts);

    const alerts: RadarAlert[] = [];

    for (const supplier of ceapSuppliers) {
      const cnpj = normalizeSupplierDocument(supplier.document);
      const company = companiesByCnpj.get(cnpj);
      const companyOpenedAt = parseDateValue(company?.data_inicio_atividade);
      const companyAgeDays = companyOpenedAt ? differenceInDays(companyOpenedAt) : undefined;
      const matchedContracts = pncpIndex.get(cnpj) ?? [];
      const publicBodyCount = new Set(
        matchedContracts
          .map(
            (contract) =>
              contract.orgaoEntidade?.cnpj ??
              contract.orgaoEntidade?.razaoSocial ??
              contract.unidadeOrgao?.nomeUnidade
          )
          .filter(Boolean)
      ).size;
      const reasons = buildRadarReasonSet(
        supplier,
        companyOpenedAt,
        matchedContracts,
        publicBodyCount
      );

      if (!shouldIncludeAlert(supplier, companyAgeDays, matchedContracts, reasons)) {
        continue;
      }

      const riskScore = getAlertRiskScore(supplier, companyAgeDays, matchedContracts, reasons);

      alerts.push({
        supplierId: supplier.id,
        supplierHref: supplier.href,
        supplierName: supplier.name,
        supplierDocument: cnpj,
        ceapTotalAmount: supplier.totalAmount,
        ceapDeputyCount: supplier.deputyCount,
        ceapExpenseCount: supplier.expenseCount,
        topCategory: supplier.topCategory,
        companyOpenedAt: company?.data_inicio_atividade ?? companyOpenedAt?.toISOString(),
        companyAgeDays,
        companyOfficialName: company?.razao_social,
        companyStatus: company?.descricao_situacao_cadastral,
        companyCity: company?.municipio,
        companyState: company?.uf,
        pncpContractsCount: matchedContracts.length,
        publicBodyCount,
        riskScore,
        riskLevel: getAlertRiskLevel(riskScore, companyAgeDays, matchedContracts),
        reasons,
        recentContracts: [...matchedContracts]
          .sort((left, right) => getContractSortValue(right) - getContractSortValue(left))
          .slice(0, 3)
          .map((contract) => buildContractSnippet(contract))
      });
    }

    alerts.sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }

      return right.ceapTotalAmount - left.ceapTotalAmount;
    });
    const limitedAlerts = alerts.slice(0, RADAR_ALERT_LIMIT);

    return {
      updatedAt: checkedAt,
      windowStart,
      windowEnd,
      sourceStatus: [
        ceapSourceStatus,
        buildBrasilApiStatus(
          checkedAt,
          ceapSuppliers.length,
          resolvedCompanies,
          rejectedCompanies
        ),
        buildPncpStatus(
          checkedAt,
          windowStart,
          windowEnd,
          pncpSnapshot.pagesFetched,
          pncpSnapshot.totalPages,
          pncpSnapshot.contracts.length,
          pncpSnapshot.matchedSuppliers,
          pncpErrorDetails
        )
      ],
      totals: {
        analyzedSuppliers: ceapSuppliers.length,
        flaggedSuppliers: limitedAlerts.length,
        recentCompanies: limitedAlerts.filter(
          (alert) =>
            typeof alert.companyAgeDays === "number" &&
            alert.companyAgeDays <= RECENT_COMPANY_MAX_DAYS
        ).length,
        matchedContracts: limitedAlerts.reduce((total, alert) => total + alert.pncpContractsCount, 0),
        matchedSuppliers: limitedAlerts.filter((alert) => alert.pncpContractsCount > 0).length
      },
      alerts: limitedAlerts
    };
  },
  ["politix-contracts-radar-v4"],
  {
    revalidate: RADAR_REVALIDATE_SECONDS
  }
);

export async function getContractsRadar() {
  return getContractsRadarCached();
}
