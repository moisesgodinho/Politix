import "server-only";

import type { ProcurementSummary } from "@/lib/types";

type PncpProcurementResponse = {
  data: PncpProcurement[];
};

type PncpProcurement = {
  anoCompra: number;
  sequencialCompra: number;
  numeroCompra: string;
  processo: string;
  objetoCompra: string;
  valorTotalHomologado: number | null;
  valorTotalEstimado: number | null;
  dataAtualizacao: string;
  dataAtualizacaoGlobal: string | null;
  dataPublicacaoPncp: string;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  modalidadeId: number;
  modalidadeNome: string;
  situacaoCompraNome: string;
  modoDisputaNome: string | null;
  linkSistemaOrigem: string | null;
  numeroControlePNCP: string;
  unidadeOrgao: {
    codigoIbge: string;
    municipioNome: string;
    nomeUnidade: string;
    ufSigla: string;
  };
  orgaoEntidade: {
    cnpj: string;
    razaoSocial: string;
  };
};

type PncpItem = {
  numeroItem: number;
  descricao: string;
  quantidade: number | null;
  unidadeMedida: string | null;
  valorUnitarioEstimado: number | null;
  valorTotal: number | null;
  criterioJulgamentoNome: string | null;
  temResultado: boolean;
};

type PncpItemResult = {
  niFornecedor: string;
  tipoPessoa: string;
  nomeRazaoSocialFornecedor: string;
  valorTotalHomologado: number | null;
  dataResultado: string | null;
};

const PNCP_API_ROOT = "https://pncp.gov.br/api";
const LICITATION_MODALITY_CODES = [3, 4, 5, 6, 7];
const SEARCH_WINDOWS_IN_DAYS = [30, 120, 365];

function formatPncpDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function subDays(baseDate: Date, days: number) {
  const copy = new Date(baseDate);
  copy.setUTCDate(copy.getUTCDate() - days);

  return copy;
}

function mapProcurement(raw: PncpProcurement): ProcurementSummary {
  return {
    id: raw.numeroControlePNCP,
    controlNumber: raw.numeroControlePNCP,
    organCnpj: raw.orgaoEntidade.cnpj,
    organName: raw.orgaoEntidade.razaoSocial,
    unitName: raw.unidadeOrgao.nomeUnidade,
    cityCode: raw.unidadeOrgao.codigoIbge,
    cityName: raw.unidadeOrgao.municipioNome,
    year: raw.anoCompra,
    sequence: raw.sequencialCompra,
    purchaseNumber: raw.numeroCompra,
    processNumber: raw.processo,
    object: raw.objetoCompra,
    modalityId: raw.modalidadeId,
    modalityName: raw.modalidadeNome,
    statusName: raw.situacaoCompraNome,
    disputeModeName: raw.modoDisputaNome,
    estimatedValue: raw.valorTotalEstimado,
    homologatedValue: raw.valorTotalHomologado,
    publicationDate: raw.dataPublicacaoPncp,
    openingDate: raw.dataAberturaProposta,
    closingDate: raw.dataEncerramentoProposta,
    updatedAt: raw.dataAtualizacaoGlobal ?? raw.dataAtualizacao,
    sourceLink: raw.linkSistemaOrigem
  };
}

async function fetchPncpJson<T>(url: string, revalidateInSeconds: number) {
  const response = await fetch(url, {
    next: {
      revalidate: revalidateInSeconds
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error(`PNCP retornou ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchRecentMunicipalProcurements(cityCode: string) {
  const sanitizedCityCode = cityCode.replace(/\D/g, "");

  for (const windowDays of SEARCH_WINDOWS_IN_DAYS) {
    const endDate = new Date();
    const startDate = subDays(endDate, windowDays);
    const dataInicial = formatPncpDate(startDate);
    const dataFinal = formatPncpDate(endDate);

    const requests = LICITATION_MODALITY_CODES.map((modalityCode) =>
      fetchPncpJson<PncpProcurementResponse>(
        `${PNCP_API_ROOT}/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicial}&dataFinal=${dataFinal}&codigoModalidadeContratacao=${modalityCode}&uf=MG&codigoMunicipioIbge=${sanitizedCityCode}&pagina=1&tamanhoPagina=10`,
        60
      )
    );

    const responses = await Promise.allSettled(requests);
    const partial = responses.some((response) => response.status === "rejected");
    const contracts = responses
      .flatMap((response) =>
        response.status === "fulfilled" ? response.value.data : []
      )
      .filter((item) => item.unidadeOrgao.codigoIbge === sanitizedCityCode)
      .sort((left, right) =>
        new Date(right.dataPublicacaoPncp).getTime() -
        new Date(left.dataPublicacaoPncp).getTime()
      )
      .map(mapProcurement);

    const dedupedContracts = Array.from(
      new Map(contracts.map((contract) => [contract.controlNumber, contract])).values()
    );

    if (dedupedContracts.length > 0) {
      return {
        partial,
        windowDays,
        contracts: dedupedContracts.slice(0, 12)
      };
    }
  }

  return {
    partial: false,
    windowDays: SEARCH_WINDOWS_IN_DAYS[SEARCH_WINDOWS_IN_DAYS.length - 1],
    contracts: [] as ProcurementSummary[]
  };
}

export async function fetchContractItems(
  organCnpj: string,
  year: number,
  sequence: number
) {
  return fetchPncpJson<PncpItem[]>(
    `${PNCP_API_ROOT}/pncp/v1/orgaos/${organCnpj}/compras/${year}/${sequence}/itens`,
    60
  );
}

export async function fetchItemResults(
  organCnpj: string,
  year: number,
  sequence: number,
  itemNumber: number
) {
  return fetchPncpJson<PncpItemResult[]>(
    `${PNCP_API_ROOT}/pncp/v1/orgaos/${organCnpj}/compras/${year}/${sequence}/itens/${itemNumber}/resultados`,
    60
  );
}
