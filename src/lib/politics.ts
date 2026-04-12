import { unstable_cache } from "next/cache";

const CAMARA_API_BASE = "https://dadosabertos.camara.leg.br/api/v2";
const SENADO_API_BASE = "https://legis.senado.leg.br/dadosabertos";
const DIRECTORY_REVALIDATE_SECONDS = 60 * 60;
const CAMARA_PAGE_SIZE = 100;
const DETAIL_REVALIDATE_SECONDS = 15 * 60;
const DEPUTY_EXPENSE_PAGE_SIZE = 100;
const DEPUTY_EXPENSE_MAX_PAGES = 6;

export const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO"
] as const;

export type PoliticianSource = "camara" | "senado";
export type PoliticianOffice = "Deputado Federal" | "Senador";
export type PoliticianHouse = "Câmara dos Deputados" | "Senado Federal";

export type Politician = {
  id: string;
  externalId: string;
  source: PoliticianSource;
  sourceLabel: PoliticianHouse;
  house: PoliticianHouse;
  office: PoliticianOffice;
  name: string;
  fullName?: string;
  party: string;
  state: string;
  city?: string;
  email?: string;
  photoUrl?: string;
  profileUrl?: string;
  legislature?: string;
  status?: string;
};

export type PoliticianSearchFilters = {
  query?: string;
  state?: string;
  city?: string;
  party?: string;
  house?: PoliticianSource;
};

export type NormalizedPoliticianSearchFilters = {
  query: string;
  state: string;
  city: string;
  party: string;
  house: PoliticianSource | "";
};

export type PoliticianDirectorySourceStatus = {
  id: string;
  label: string;
  status: "ok" | "degraded";
  sourceUrl: string;
  checkedAt: string;
  updateCadence?: string;
  details: string;
};

export type PoliticianSearchResult = {
  items: Politician[];
  filters: NormalizedPoliticianSearchFilters;
  availableStates: string[];
  availableCities: string[];
  availableParties: string[];
  matchingCount: number;
  updatedAt: string;
  sourceStatus: PoliticianDirectorySourceStatus[];
  summary: {
    total: number;
    camara: number;
    senado: number;
    states: number;
  };
};

export type DeputyCabinet = {
  name?: string;
  building?: string;
  room?: string;
  floor?: string;
  phone?: string;
  email?: string;
};

export type DeputyExpense = {
  documentDate?: string;
  supplierName?: string;
  supplierDocument?: string;
  expenseType?: string;
  documentType?: string;
  documentNumber?: string;
  documentUrl?: string;
  amount: number;
  netAmount?: number;
  reimbursedAmount?: number;
  year?: number;
  month?: number;
};

export type ExpenseSeriesPoint = {
  label: string;
  totalAmount: number;
  totalNetAmount: number;
  expenseCount: number;
};

export type ExpenseRankingPoint = {
  label: string;
  secondaryLabel?: string;
  totalAmount: number;
  expenseCount: number;
};

export type DeputyDetails = Politician & {
  civilName?: string;
  cpf?: string;
  gender?: string;
  birthDate?: string;
  birthState?: string;
  birthCity?: string;
  education?: string;
  website?: string;
  socialMedia: string[];
  cabinet?: DeputyCabinet;
  expenses: DeputyExpense[];
  latestExpenses: DeputyExpense[];
  expenseSummary: {
    count: number;
    totalAmount: number;
    totalNetAmount: number;
    uniqueSuppliers: number;
    averageAmount: number;
    highestSingleExpenseAmount: number;
    topSupplierName?: string;
    topSupplierTotalAmount: number;
    topExpenseType?: string;
    topExpenseTypeTotalAmount: number;
  };
  monthlyExpenses: ExpenseSeriesPoint[];
  topSuppliers: ExpenseRankingPoint[];
  expenseCategories: ExpenseRankingPoint[];
};

type CamaraDeputy = {
  id: number;
  uri?: string;
  nome: string;
  siglaPartido?: string;
  siglaUf?: string;
  idLegislatura?: number;
  urlFoto?: string;
  email?: string;
};

type CamaraResponse = {
  dados?: CamaraDeputy[];
  links?: Array<{
    rel?: string;
    href?: string;
  }>;
};

type CamaraDeputyDetailsResponse = {
  dados?: {
    id?: number;
    uri?: string;
    nomeCivil?: string;
    cpf?: string;
    sexo?: string;
    urlWebsite?: string;
    redeSocial?: string[];
    dataNascimento?: string;
    ufNascimento?: string;
    municipioNascimento?: string;
    escolaridade?: string;
    ultimoStatus?: {
      id?: number;
      uri?: string;
      nome?: string;
      nomeEleitoral?: string;
      siglaPartido?: string;
      siglaUf?: string;
      idLegislatura?: number;
      urlFoto?: string;
      email?: string;
      data?: string;
      situacao?: string;
      gabinete?: {
        nome?: string;
        predio?: string;
        sala?: string;
        andar?: string;
        telefone?: string;
        email?: string;
      };
    };
  };
};

type CamaraExpenseResponse = {
  dados?: Array<{
    ano?: number;
    mes?: number;
    tipoDespesa?: string;
    tipoDocumento?: string;
    dataDocumento?: string;
    numDocumento?: string;
    valorDocumento?: number;
    valorLiquido?: number;
    valorGlosa?: number;
    nomeFornecedor?: string;
    cnpjCpfFornecedor?: string;
    urlDocumento?: string;
  }>;
  links?: Array<{
    rel?: string;
    href?: string;
  }>;
};

type SenadoMandate = {
  UfParlamentar?: string;
  DescricaoParticipacao?: string;
  PrimeiraLegislaturaDoMandato?: {
    NumeroLegislatura?: string;
  };
  SegundaLegislaturaDoMandato?: {
    NumeroLegislatura?: string;
  };
};

type SenadoParlamentar = {
  CodigoParlamentar?: string;
  NomeParlamentar?: string;
  NomeCompletoParlamentar?: string;
  EmailParlamentar?: string;
  SiglaPartidoParlamentar?: string;
  UfParlamentar?: string;
  UrlFotoParlamentar?: string;
  UrlPaginaParlamentar?: string;
  DescricaoParticipacao?: string;
  MunicipioParlamentar?: string;
  IdentificacaoParlamentar?: {
    CodigoParlamentar?: string;
    NomeParlamentar?: string;
    NomeCompletoParlamentar?: string;
    EmailParlamentar?: string;
    SiglaPartidoParlamentar?: string;
    UfParlamentar?: string;
    UrlFotoParlamentar?: string;
    UrlPaginaParlamentar?: string;
    MunicipioParlamentar?: string;
    LocalidadeParlamentar?: {
      NomeMunicipio?: string;
    };
  };
  Mandato?: SenadoMandate | SenadoMandate[];
};

type SenadoResponse = {
  ListaParlamentarEmExercicio?: {
    Parlamentares?: {
      Parlamentar?: SenadoParlamentar | SenadoParlamentar[];
    };
  };
};

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function pickFirst(...values: Array<string | number | undefined | null>) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeText(value?: string) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeFilters(filters: PoliticianSearchFilters): NormalizedPoliticianSearchFilters {
  return {
    query: (filters.query ?? "").trim(),
    state: (filters.state ?? "").toUpperCase().trim(),
    city: (filters.city ?? "").trim(),
    party: (filters.party ?? "").toUpperCase().trim(),
    house: ((filters.house ?? "") as PoliticianSource | "").trim() as PoliticianSource | ""
  };
}

function getSenadoMandate(mandate: SenadoParlamentar["Mandato"]) {
  if (!mandate) {
    return undefined;
  }

  return Array.isArray(mandate) ? mandate[0] : mandate;
}

function sleep(timeoutMs: number) {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

function getCamaraOfficialProfileUrl(id: string | number) {
  return `https://www.camara.leg.br/deputados/${id}/biografia`;
}

function formatMonthYear(month?: number, year?: number) {
  if (!month || !year) {
    return "Sem periodo";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit"
  }).format(new Date(year, month - 1, 1));
}

function getExpenseSortValue(expense: DeputyExpense) {
  if (expense.documentDate) {
    const timestamp = new Date(expense.documentDate).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  const year = expense.year ?? 0;
  const month = expense.month ?? 1;
  return new Date(year, month - 1, 1).getTime();
}

async function fetchGovernmentJson<T>(
  url: string,
  options: {
    revalidateSeconds?: number;
    tags?: string[];
    retries?: number;
  } = {}
): Promise<T> {
  const {
    revalidateSeconds = DIRECTORY_REVALIDATE_SECONDS,
    tags = ["politicians"],
    retries = 2
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        },
        cache: "force-cache",
        next: {
          revalidate: revalidateSeconds,
          tags
        }
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Erro temporário no upstream (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`Falha ao consultar ${url}: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      const backoffMs = 350 * 2 ** attempt + Math.floor(Math.random() * 150);
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Falha inesperada ao consultar ${url}`);
}

function mapCamaraDeputy(deputy: CamaraDeputy): Politician {
  return {
    id: `camara-${deputy.id}`,
    externalId: String(deputy.id),
    source: "camara",
    sourceLabel: "Câmara dos Deputados",
    house: "Câmara dos Deputados",
    office: "Deputado Federal",
    name: deputy.nome,
    fullName: deputy.nome,
    party: deputy.siglaPartido ?? "Sem partido",
    state: deputy.siglaUf ?? "",
    email: deputy.email ?? undefined,
    photoUrl: deputy.urlFoto ?? undefined,
    profileUrl: getCamaraOfficialProfileUrl(deputy.id),
    legislature: deputy.idLegislatura ? String(deputy.idLegislatura) : undefined,
    status: "Em exercício"
  };
}

function mapSenador(senator: SenadoParlamentar): Politician {
  const identity = senator.IdentificacaoParlamentar ?? {};
  const mandate = getSenadoMandate(senator.Mandato);
  const code = pickFirst(identity.CodigoParlamentar, senator.CodigoParlamentar, senator.NomeParlamentar);
  const state = String(pickFirst(identity.UfParlamentar, mandate?.UfParlamentar, senator.UfParlamentar) ?? "");
  const city = String(
    pickFirst(
      identity.LocalidadeParlamentar?.NomeMunicipio,
      identity.MunicipioParlamentar,
      senator.MunicipioParlamentar
    ) ?? ""
  );

  return {
    id: `senado-${code}`,
    externalId: String(code),
    source: "senado",
    sourceLabel: "Senado Federal",
    house: "Senado Federal",
    office: "Senador",
    name: String(pickFirst(identity.NomeParlamentar, senator.NomeParlamentar, "Parlamentar sem nome")),
    fullName: String(
      pickFirst(
        identity.NomeCompletoParlamentar,
        senator.NomeCompletoParlamentar,
        identity.NomeParlamentar,
        senator.NomeParlamentar
      )
    ),
    party: String(pickFirst(identity.SiglaPartidoParlamentar, senator.SiglaPartidoParlamentar, "Sem partido")),
    state,
    city: city || undefined,
    email: String(pickFirst(identity.EmailParlamentar, senator.EmailParlamentar) ?? "") || undefined,
    photoUrl:
      String(pickFirst(identity.UrlFotoParlamentar, senator.UrlFotoParlamentar) ?? "") || undefined,
    profileUrl:
      String(pickFirst(identity.UrlPaginaParlamentar, senator.UrlPaginaParlamentar) ?? "") || undefined,
    legislature: String(
      pickFirst(
        mandate?.PrimeiraLegislaturaDoMandato?.NumeroLegislatura,
        mandate?.SegundaLegislaturaDoMandato?.NumeroLegislatura
      ) ?? ""
    ) || undefined,
    status: String(pickFirst(mandate?.DescricaoParticipacao, senator.DescricaoParticipacao, "Em exercício"))
  };
}

export async function listCamaraDeputies(): Promise<Politician[]> {
  const directory: Politician[] = [];
  let page = 1;

  while (page < 20) {
    const url = new URL(`${CAMARA_API_BASE}/deputados`);
    url.searchParams.set("pagina", String(page));
    url.searchParams.set("itens", String(CAMARA_PAGE_SIZE));
    url.searchParams.set("ordem", "ASC");
    url.searchParams.set("ordenarPor", "nome");

    const response = await fetchGovernmentJson<CamaraResponse>(url.toString(), {
      tags: ["politicians", "camara-deputados"]
    });

    const currentPage = toArray(response.dados);

    if (currentPage.length === 0) {
      break;
    }

    directory.push(...currentPage.map(mapCamaraDeputy));

    const hasNextPage = toArray(response.links).some((link) => link.rel === "next");
    if (!hasNextPage) {
      break;
    }

    page += 1;
  }

  return directory;
}

export async function listSenators(): Promise<Politician[]> {
  const response = await fetchGovernmentJson<SenadoResponse>(
    `${SENADO_API_BASE}/senador/lista/atual.json`,
    {
      tags: ["politicians", "senado-senadores"]
    }
  );

  const senators = toArray(response.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar);
  return senators.map(mapSenador);
}

function mapDeputyExpense(
  expense: NonNullable<CamaraExpenseResponse["dados"]>[number]
): DeputyExpense {
  return {
    documentDate: expense.dataDocumento,
    supplierName: expense.nomeFornecedor,
    supplierDocument: expense.cnpjCpfFornecedor,
    expenseType: expense.tipoDespesa,
    documentType: expense.tipoDocumento,
    documentNumber: expense.numDocumento,
    documentUrl: expense.urlDocumento,
    amount: expense.valorDocumento ?? 0,
    netAmount: expense.valorLiquido ?? undefined,
    reimbursedAmount: expense.valorGlosa ?? undefined,
    year: expense.ano,
    month: expense.mes
  };
}

async function listDeputyExpenses(id: string) {
  const expenses: DeputyExpense[] = [];
  let page = 1;

  while (page <= DEPUTY_EXPENSE_MAX_PAGES) {
    const url = new URL(`${CAMARA_API_BASE}/deputados/${id}/despesas`);
    url.searchParams.set("ordem", "DESC");
    url.searchParams.set("ordenarPor", "ano");
    url.searchParams.set("itens", String(DEPUTY_EXPENSE_PAGE_SIZE));
    url.searchParams.set("pagina", String(page));

    const response = await fetchGovernmentJson<CamaraExpenseResponse>(url.toString(), {
      revalidateSeconds: DETAIL_REVALIDATE_SECONDS,
      tags: ["politicians", `camara-deputado-${id}`, "camara-despesas"]
    });

    const currentPage = toArray(response.dados).map(mapDeputyExpense);

    if (currentPage.length === 0) {
      break;
    }

    expenses.push(...currentPage);

    const hasNextPage = toArray(response.links).some((link) => link.rel === "next");

    if (!hasNextPage) {
      break;
    }

    page += 1;
  }

  return expenses;
}

function buildExpenseSeries(expenses: DeputyExpense[]) {
  const monthlyMap = new Map<string, ExpenseSeriesPoint & { sortKey: number }>();
  const supplierMap = new Map<string, ExpenseRankingPoint>();
  const categoryMap = new Map<string, ExpenseRankingPoint>();

  for (const expense of expenses) {
    const year = expense.year ?? 0;
    const month = expense.month ?? 0;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const monthlyEntry = monthlyMap.get(monthKey) ?? {
      label: formatMonthYear(month, year),
      totalAmount: 0,
      totalNetAmount: 0,
      expenseCount: 0,
      sortKey: year * 100 + month
    };

    monthlyEntry.totalAmount += expense.amount;
    monthlyEntry.totalNetAmount += expense.netAmount ?? expense.amount;
    monthlyEntry.expenseCount += 1;
    monthlyMap.set(monthKey, monthlyEntry);

    const supplierKey = expense.supplierDocument ?? expense.supplierName ?? "Fornecedor nao informado";
    const supplierEntry = supplierMap.get(supplierKey) ?? {
      label: expense.supplierName ?? "Fornecedor nao informado",
      secondaryLabel: expense.supplierDocument,
      totalAmount: 0,
      expenseCount: 0
    };
    supplierEntry.totalAmount += expense.amount;
    supplierEntry.expenseCount += 1;
    supplierMap.set(supplierKey, supplierEntry);

    const categoryKey = expense.expenseType ?? "Categoria nao informada";
    const categoryEntry = categoryMap.get(categoryKey) ?? {
      label: categoryKey,
      totalAmount: 0,
      expenseCount: 0
    };
    categoryEntry.totalAmount += expense.amount;
    categoryEntry.expenseCount += 1;
    categoryMap.set(categoryKey, categoryEntry);
  }

  const monthlyExpenses = [...monthlyMap.values()]
    .sort((left, right) => left.sortKey - right.sortKey)
    .map(({ sortKey: _sortKey, ...item }) => item)
    .slice(-6);

  const topSuppliers = [...supplierMap.values()]
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 5);

  const expenseCategories = [...categoryMap.values()]
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 6);

  return {
    monthlyExpenses,
    topSuppliers,
    expenseCategories
  };
}

const getPoliticianDirectory = unstable_cache(
  async () => {
    const checkedAt = new Date().toISOString();
    const [deputiesResult, senatorsResult] = await Promise.allSettled([
      listCamaraDeputies(),
      listSenators()
    ]);

    const deputies = deputiesResult.status === "fulfilled" ? deputiesResult.value : [];
    const senators = senatorsResult.status === "fulfilled" ? senatorsResult.value : [];

    if (deputies.length === 0 && senators.length === 0) {
      throw new Error("Nao foi possivel carregar o diretorio oficial de parlamentares.");
    }

    return {
      checkedAt,
      items: [...deputies, ...senators].sort((left, right) =>
        left.name.localeCompare(right.name, "pt-BR")
      )
    };
  },
  ["politix-politician-directory-v1"],
  {
    revalidate: DIRECTORY_REVALIDATE_SECONDS
  }
);

function matchesFilters(politician: Politician, filters: NormalizedPoliticianSearchFilters) {
  const normalizedQuery = normalizeText(filters.query);
  const normalizedCity = normalizeText(filters.city);
  const normalizedPartyFilter = normalizeText(filters.party);
  const normalizedName = normalizeText(politician.name);
  const normalizedParty = normalizeText(politician.party);
  const normalizedState = normalizeText(politician.state);
  const normalizedPoliticianCity = normalizeText(politician.city);

  const matchesQuery =
    !normalizedQuery ||
    normalizedName.includes(normalizedQuery) ||
    normalizedParty.includes(normalizedQuery) ||
    normalizedState.includes(normalizedQuery);

  const matchesState = !filters.state || politician.state === filters.state;
  const matchesCity = !normalizedCity || normalizedPoliticianCity.includes(normalizedCity);
  const matchesParty = !normalizedPartyFilter || normalizedParty === normalizedPartyFilter;
  const matchesHouse = !filters.house || politician.source === filters.house;

  return matchesQuery && matchesState && matchesCity && matchesParty && matchesHouse;
}

export async function getAvailableCities(state?: string) {
  const directory = await getPoliticianDirectory();
  return extractAvailableCities(directory.items, state);
}

function extractAvailableCities(directory: Politician[], state?: string) {
  return Array.from(
    new Set(
      directory
        .filter((politician) => !state || politician.state === state)
        .map((politician) => politician.city)
        .filter((city): city is string => Boolean(city))
    )
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export async function searchPoliticians(
  filters: PoliticianSearchFilters = {}
): Promise<PoliticianSearchResult> {
  const normalizedFilters = normalizeFilters(filters);
  const directory = await getPoliticianDirectory();
  const filtered = directory.items.filter((politician) => matchesFilters(politician, normalizedFilters));

  return {
    items: filtered,
    filters: normalizedFilters,
    availableStates: [...BRAZILIAN_STATES],
    availableCities: extractAvailableCities(directory.items, normalizedFilters.state),
    availableParties: Array.from(
      new Set(directory.items.map((politician) => politician.party).filter(Boolean))
    ).sort((left, right) => left.localeCompare(right, "pt-BR")),
    matchingCount: filtered.length,
    updatedAt: directory.checkedAt,
    sourceStatus: [
      {
        id: "camara-directory",
        label: "Diretorio da Camara",
        status: "ok",
        sourceUrl: `${CAMARA_API_BASE}/deputados`,
        checkedAt: directory.checkedAt,
        updateCadence: "Revalidacao no app a cada 1 hora",
        details: "Lista oficial de deputados em exercicio consumida pela API v2."
      },
      {
        id: "senado-directory",
        label: "Diretorio do Senado",
        status: "ok",
        sourceUrl: `${SENADO_API_BASE}/senador/lista/atual.json`,
        checkedAt: directory.checkedAt,
        updateCadence: "Revalidacao no app a cada 1 hora",
        details: "Lista oficial de senadores em exercicio consolidada no servidor."
      }
    ],
    summary: {
      total: directory.items.length,
      camara: directory.items.filter((politician) => politician.source === "camara").length,
      senado: directory.items.filter((politician) => politician.source === "senado").length,
      states: new Set(directory.items.map((politician) => politician.state).filter(Boolean)).size
    }
  };
}

const getDeputyDetailsCached = unstable_cache(
  async (id: string) => {
    const [directoryBundle, detailsResponse, loadedExpenses] = await Promise.all([
      getPoliticianDirectory(),
      fetchGovernmentJson<CamaraDeputyDetailsResponse>(`${CAMARA_API_BASE}/deputados/${id}`, {
        revalidateSeconds: DETAIL_REVALIDATE_SECONDS,
        tags: ["politicians", `camara-deputado-${id}`]
      }),
      listDeputyExpenses(id)
    ]);
    const directory = directoryBundle.items;

    const directoryEntry = directory.find(
      (politician) => politician.source === "camara" && politician.externalId === id
    );

    if (!directoryEntry) {
      throw new Error(`Deputado ${id} nao encontrado no diretorio local.`);
    }

    const details = detailsResponse.dados;
    const latestStatus = details?.ultimoStatus;
    const sortedLatestExpenses = [...loadedExpenses].sort((left, right) => {
      return getExpenseSortValue(right) - getExpenseSortValue(left);
    });
    const { monthlyExpenses, topSuppliers, expenseCategories } =
      buildExpenseSeries(sortedLatestExpenses);
    const topSupplier = topSuppliers[0];
    const topExpenseType = expenseCategories[0];

    return {
      ...directoryEntry,
      name: latestStatus?.nomeEleitoral ?? latestStatus?.nome ?? directoryEntry.name,
      fullName: details?.nomeCivil ?? directoryEntry.fullName,
      civilName: details?.nomeCivil ?? undefined,
      cpf: details?.cpf ?? undefined,
      gender: details?.sexo ?? undefined,
      birthDate: details?.dataNascimento ?? undefined,
      birthState: details?.ufNascimento ?? undefined,
      birthCity: details?.municipioNascimento ?? undefined,
      education: details?.escolaridade ?? undefined,
      website: details?.urlWebsite ?? undefined,
      socialMedia: toArray(details?.redeSocial).filter(Boolean),
      state: latestStatus?.siglaUf ?? directoryEntry.state,
      party: latestStatus?.siglaPartido ?? directoryEntry.party,
      photoUrl: latestStatus?.urlFoto ?? directoryEntry.photoUrl,
      email: latestStatus?.email ?? directoryEntry.email,
      profileUrl: getCamaraOfficialProfileUrl(id),
      legislature: latestStatus?.idLegislatura
        ? String(latestStatus.idLegislatura)
        : directoryEntry.legislature,
      status: latestStatus?.situacao ?? directoryEntry.status,
      cabinet: latestStatus?.gabinete
        ? {
            name: latestStatus.gabinete.nome,
            building: latestStatus.gabinete.predio,
            room: latestStatus.gabinete.sala,
            floor: latestStatus.gabinete.andar,
            phone: latestStatus.gabinete.telefone,
            email: latestStatus.gabinete.email
          }
        : undefined,
      expenses: sortedLatestExpenses,
      latestExpenses: sortedLatestExpenses.slice(0, 12),
      expenseSummary: {
        count: sortedLatestExpenses.length,
        totalAmount: sortedLatestExpenses.reduce((total, item) => total + item.amount, 0),
        totalNetAmount: sortedLatestExpenses.reduce(
          (total, item) => total + (item.netAmount ?? item.amount),
          0
        ),
        uniqueSuppliers: new Set(
          sortedLatestExpenses
            .map((item) => item.supplierDocument ?? item.supplierName)
            .filter(Boolean)
        ).size,
        averageAmount:
          sortedLatestExpenses.length > 0
            ? sortedLatestExpenses.reduce((total, item) => total + item.amount, 0) /
              sortedLatestExpenses.length
            : 0,
        highestSingleExpenseAmount: Math.max(
          0,
          ...sortedLatestExpenses.map((item) => item.amount)
        ),
        topSupplierName: topSupplier?.label,
        topSupplierTotalAmount: topSupplier?.totalAmount ?? 0,
        topExpenseType: topExpenseType?.label,
        topExpenseTypeTotalAmount: topExpenseType?.totalAmount ?? 0
      },
      monthlyExpenses,
      topSuppliers,
      expenseCategories
    } satisfies DeputyDetails;
  },
  ["politix-deputy-details-v1"],
  {
    revalidate: DETAIL_REVALIDATE_SECONDS
  }
);

export async function getDeputyDetails(id: string): Promise<DeputyDetails> {
  return getDeputyDetailsCached(id);
}
