import { inflateRawSync } from "node:zlib";

import { searchPoliticians, type Politician } from "@/lib/politics";
import {
  buildSupplierHref,
  getSupplierLookupKey,
  normalizeSupplierDocument,
  slugifySupplierName
} from "@/lib/suppliers";

const CEAP_REVALIDATE_SECONDS = 6 * 60 * 60;
const CEAP_DEGRADED_REVALIDATE_SECONDS = 10 * 60;
const PREFERRED_CEAP_YEAR = new Date().getFullYear();
const CEAP_MAX_FALLBACK_YEARS = 6;

type CeapRawRecord = Record<string, unknown>;

export type CeapExpenseRecord = {
  year: number;
  month: number;
  deputyId?: string;
  deputyName: string;
  party?: string;
  state?: string;
  supplierName: string;
  supplierDocument?: string;
  expenseType: string;
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  documentUrl?: string;
  amount: number;
  netAmount: number;
};

export type SourceStatus = {
  id: string;
  label: string;
  status: "ok" | "degraded";
  sourceUrl: string;
  checkedAt: string;
  upstreamLastModified?: string;
  updateCadence?: string;
  details: string;
};

export type SupplierSummary = {
  id: string;
  name: string;
  document?: string;
  href: string;
  totalAmount: number;
  totalNetAmount: number;
  expenseCount: number;
  deputyCount: number;
  topCategory?: string;
};

export type SupplierDetails = SupplierSummary & {
  categories: Array<{
    category: string;
    totalAmount: number;
    expenseCount: number;
  }>;
  deputies: Array<{
    deputyId?: string;
    deputyName: string;
    party?: string;
    state?: string;
    totalAmount: number;
    expenseCount: number;
    profileHref?: string;
  }>;
  recentExpenses: CeapExpenseRecord[];
};

export type DeputySpendingRank = {
  deputyId?: string;
  deputyName: string;
  party?: string;
  state?: string;
  totalAmount: number;
  totalNetAmount: number;
  expenseCount: number;
  uniqueSuppliers: number;
  detailsHref?: string;
};

export type GroupRankingItem = {
  label: string;
  totalAmount: number;
  totalNetAmount: number;
  deputyCount: number;
  averageAmount: number;
};

export type SupplierRankingItem = {
  supplierId: string;
  supplierName: string;
  supplierDocument?: string;
  href: string;
  totalAmount: number;
  expenseCount: number;
  deputyCount: number;
};

export type CeapAlert = {
  id: string;
  type: "spending_spike" | "supplier_concentration";
  severity: "medium" | "high";
  title: string;
  description: string;
  href?: string;
};

export type RankingFilters = {
  uf?: string;
  party?: string;
  minSpend?: number;
  maxSpend?: number;
};

export type CeapAnalyticsBase = {
  year: number;
  updatedAt: string;
  sourceStatus: SourceStatus[];
  availableStates: string[];
  availableParties: string[];
  totals: {
    totalAmount: number;
    totalNetAmount: number;
    expenseCount: number;
    deputyCount: number;
    supplierCount: number;
  };
  topDeputies: DeputySpendingRank[];
  topStates: GroupRankingItem[];
  topParties: GroupRankingItem[];
  topSuppliers: SupplierRankingItem[];
  alerts: CeapAlert[];
  suppliers: SupplierSummary[];
};

export type CeapAnalytics = CeapAnalyticsBase & {
  filteredDeputies: DeputySpendingRank[];
  appliedFilters: {
    uf: string;
    party: string;
    minSpend?: number;
    maxSpend?: number;
  };
};

type CeapFilePayload = {
  year: number;
  preferredYear: number;
  attemptedYears: number[];
  payload: unknown;
  checkedAt: string;
  sourceUrl: string;
  upstreamLastModified?: string;
};

type CachedCeapDataset = {
  year: number;
  preferredYear: number;
  attemptedYears: number[];
  records: CeapExpenseRecord[];
  checkedAt: string;
  sourceUrl: string;
  upstreamLastModified?: string;
  status: "ok" | "degraded";
  errorDetails?: string;
};

type MemoryCacheEntry<T> = {
  value?: T;
  expiresAt: number;
  pending?: Promise<T>;
};

const ceapDatasetMemoryCache: MemoryCacheEntry<CachedCeapDataset> = {
  expiresAt: 0
};

const ceapAnalyticsMemoryCache: MemoryCacheEntry<CeapAnalyticsBase> = {
  expiresAt: 0
};

// A CEAP anual gera objetos grandes demais para o data cache do Next (> 2 MB),
// entao usamos um cache em memoria simples neste modulo.
const ceapModuleCache = new Map<string, MemoryCacheEntry<unknown>>();

function unstable_cache<TArgs extends unknown[], TResult>(
  loader: (...args: TArgs) => Promise<TResult>,
  keyParts: string[] = [],
  options?: {
    revalidate?: number;
  }
) {
  return async (...args: TArgs): Promise<TResult> => {
    const cacheKey = JSON.stringify([keyParts, args]);
    const ttlMs = (options?.revalidate ?? CEAP_REVALIDATE_SECONDS) * 1000;
    const now = Date.now();
    const current = ceapModuleCache.get(cacheKey);

    if (current?.value !== undefined && now < current.expiresAt) {
      return current.value as TResult;
    }

    if (current?.pending) {
      return current.pending as Promise<TResult>;
    }

    const nextEntry: MemoryCacheEntry<unknown> = current ?? {
      expiresAt: 0
    };

    nextEntry.pending = loader(...args)
      .then((value) => {
        nextEntry.value = value;
        nextEntry.expiresAt = Date.now() + ttlMs;
        return value;
      })
      .finally(() => {
        nextEntry.pending = undefined;
      });

    ceapModuleCache.set(cacheKey, nextEntry);

    return nextEntry.pending as Promise<TResult>;
  };
}

function buildDegradedCeapDataset(error: unknown): CachedCeapDataset {
  const checkedAt = new Date().toISOString();
  const errorDetails =
    error instanceof Error ? error.message : "Falha desconhecida ao consultar a CEAP.";

  return {
    year: PREFERRED_CEAP_YEAR,
    preferredYear: PREFERRED_CEAP_YEAR,
    attemptedYears: [PREFERRED_CEAP_YEAR],
    records: [],
    checkedAt,
    sourceUrl: buildCeapZipUrl(PREFERRED_CEAP_YEAR),
    upstreamLastModified: undefined,
    status: "degraded",
    errorDetails
  };
}

function pickString(record: CeapRawRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return fallback;
}

function pickNumber(record: CeapRawRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = Number(value.replace(/\./g, "").replace(",", "."));

      if (Number.isFinite(normalized)) {
        return normalized;
      }
    }
  }

  return 0;
}

function sanitizeJsonText(payload: string) {
  return payload.replace(/^\u0000+/, "").replace(/^\uFEFF/, "").trimStart();
}

function buildCeapJsonUrl(year: number) {
  return `https://www.camara.leg.br/cotas/Ano-${year}.json`;
}

function buildCeapZipUrl(year: number) {
  return `https://www.camara.leg.br/cotas/Ano-${year}.json.zip`;
}

function parseJsonPayload(payload: string) {
  const rawPayload = sanitizeJsonText(payload);

  if (!rawPayload || rawPayload.startsWith("<")) {
    return undefined;
  }

  try {
    return JSON.parse(rawPayload) as unknown;
  } catch {
    return undefined;
  }
}

function findZipEndOfCentralDirectoryOffset(buffer: Buffer) {
  const signature = 0x06054b50;
  const minimumRecordSize = 22;
  const searchStart = Math.max(0, buffer.length - 0xffff - minimumRecordSize);

  for (let offset = buffer.length - minimumRecordSize; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }

  return -1;
}

function extractFirstZipEntry(buffer: Buffer) {
  const endOfCentralDirectoryOffset = findZipEndOfCentralDirectoryOffset(buffer);

  if (endOfCentralDirectoryOffset < 0) {
    throw new Error("Arquivo ZIP da CEAP sem diretório central válido.");
  }

  const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);

  if (buffer.readUInt32LE(centralDirectoryOffset) !== 0x02014b50) {
    throw new Error("Entrada central do ZIP da CEAP inválida.");
  }

  const compressionMethod = buffer.readUInt16LE(centralDirectoryOffset + 10);
  const compressedSize = buffer.readUInt32LE(centralDirectoryOffset + 20);
  const fileNameLength = buffer.readUInt16LE(centralDirectoryOffset + 28);
  const extraFieldLength = buffer.readUInt16LE(centralDirectoryOffset + 30);
  const fileCommentLength = buffer.readUInt16LE(centralDirectoryOffset + 32);
  const localHeaderOffset = buffer.readUInt32LE(centralDirectoryOffset + 42);
  const fileName = buffer
    .subarray(centralDirectoryOffset + 46, centralDirectoryOffset + 46 + fileNameLength)
    .toString("utf8");
  const nextCentralOffset =
    centralDirectoryOffset + 46 + fileNameLength + extraFieldLength + fileCommentLength;

  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("Cabeçalho local do ZIP da CEAP inválido.");
  }

  const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const compressedDataStart =
    localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
  const compressedDataEnd = compressedDataStart + compressedSize;
  const compressedData = buffer.subarray(compressedDataStart, compressedDataEnd);

  const entryBuffer =
    compressionMethod === 0
      ? compressedData
      : compressionMethod === 8
        ? inflateRawSync(compressedData)
        : undefined;

  if (!entryBuffer) {
    throw new Error(`Método de compressão ZIP não suportado: ${compressionMethod}.`);
  }

  return {
    fileName,
    content: entryBuffer,
    hasMoreEntries: nextCentralOffset < endOfCentralDirectoryOffset
  };
}

async function fetchCeapJsonFromZip(year: number) {
  const checkedAt = new Date().toISOString();
  const url = buildCeapZipUrl(year);
  const response = await fetch(url, {
    cache: "force-cache",
    next: {
      revalidate: CEAP_REVALIDATE_SECONDS,
      tags: ["ceap", `ceap-${year}`, `ceap-zip-${year}`]
    }
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Falha ao consultar CEAP ZIP ${year}: ${response.status}`);
  }

  const zipBuffer = Buffer.from(await response.arrayBuffer());

  if (zipBuffer.length === 0) {
    return undefined;
  }

  const entry = extractFirstZipEntry(zipBuffer);
  const parsedPayload = parseJsonPayload(entry.content.toString("utf8"));

  if (!parsedPayload) {
    return undefined;
  }

  return {
    year,
    payload: parsedPayload,
    checkedAt,
    sourceUrl: url,
    upstreamLastModified: response.headers.get("last-modified") ?? undefined
  };
}

async function fetchCeapJsonFromRaw(year: number) {
  const checkedAt = new Date().toISOString();
  const url = buildCeapJsonUrl(year);
  const response = await fetch(url, {
    cache: "force-cache",
    next: {
      revalidate: CEAP_REVALIDATE_SECONDS,
      tags: ["ceap", `ceap-${year}`, `ceap-raw-${year}`]
    }
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Falha ao consultar CEAP ${year}: ${response.status}`);
  }

  const parsedPayload = parseJsonPayload(await response.text());

  if (!parsedPayload) {
    return undefined;
  }

  return {
    year,
    payload: parsedPayload,
    checkedAt,
    sourceUrl: url,
    upstreamLastModified: response.headers.get("last-modified") ?? undefined
  };
}

async function fetchCeapJson(year: number) {
  const zipPayload = await fetchCeapJsonFromZip(year);

  if (zipPayload) {
    return zipPayload;
  }

  return fetchCeapJsonFromRaw(year);
}

async function resolveCeapJson(preferredYear = PREFERRED_CEAP_YEAR): Promise<CeapFilePayload> {
  const attemptedYears: number[] = [];

  for (let year = preferredYear; year >= preferredYear - CEAP_MAX_FALLBACK_YEARS; year -= 1) {
    attemptedYears.push(year);
    const result = await fetchCeapJson(year);

    if (result) {
      return {
        ...result,
        preferredYear,
        attemptedYears
      };
    }
  }

  throw new Error(
    `Nenhum arquivo CEAP foi encontrado entre ${preferredYear - CEAP_MAX_FALLBACK_YEARS} e ${preferredYear}.`
  );
}

function parseCeapRecords(payload: unknown, fallbackYear: number) {
  const rawRecords =
    Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { dados?: unknown[] } | null)?.dados)
        ? ((payload as { dados?: unknown[] }).dados ?? [])
        : Array.isArray((payload as { despesas?: unknown[] } | null)?.despesas)
          ? ((payload as { despesas?: unknown[] }).despesas ?? [])
          : [];

  return rawRecords
    .map((item) => item as CeapRawRecord)
    .map((record): CeapExpenseRecord => {
      const year = pickNumber(record, ["numAno", "ano", "year"]) || fallbackYear;
      const month = pickNumber(record, ["numMes", "mes", "month"]);
      const amount = pickNumber(record, ["vlrDocumento", "valorDocumento", "valor"]);
      const netAmount =
        pickNumber(record, ["vlrLiquido", "valorLiquido", "valor_liquido"]) || amount;

      return {
        year,
        month,
        deputyId: pickString(record, ["nuDeputadoId", "ideCadastro", "idDeputado"]) || undefined,
        deputyName: pickString(
          record,
          ["txNomeParlamentar", "nomeParlamentar", "deputado"],
          "Parlamentar"
        ),
        party: pickString(record, ["sgPartido", "siglaPartido", "partido"]) || undefined,
        state: pickString(record, ["sgUF", "siglaUF", "uf"]) || undefined,
        supplierName: pickString(
          record,
          ["txtFornecedor", "nomeFornecedor", "fornecedor"],
          "Fornecedor não informado"
        ),
        supplierDocument:
          pickString(record, ["txtCNPJCPF", "cnpjCpfFornecedor", "cpfCnpjFornecedor", "cnpjCPF"]) ||
          undefined,
        expenseType:
          pickString(record, ["txtDescricao", "tipoDespesa", "descricao"], "Categoria não informada"),
        documentType:
          pickString(record, ["indTipoDocumento", "tipoDocumento", "documentoTipo"]) || undefined,
        documentNumber:
          pickString(record, ["txtNumero", "numDocumento", "numeroDocumento"]) || undefined,
        documentDate:
          pickString(record, ["datEmissao", "dataDocumento", "dataEmissao"]) || undefined,
        documentUrl:
          pickString(record, ["urlDocumento", "txtUrlDocumento", "documentoUrl"]) || undefined,
        amount,
        netAmount
      };
    })
    .filter((record) => record.deputyName && record.amount > 0);
}

function getExpenseSortValue(record: CeapExpenseRecord) {
  if (record.documentDate) {
    const parsedDate = new Date(record.documentDate).getTime();

    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }
  }

  return new Date(record.year, Math.max(0, record.month - 1), 1).getTime();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function getDeputyDetailsHref(deputyId?: string) {
  return deputyId ? `/deputados/${deputyId}` : undefined;
}

function matchesRankingFilters(record: CeapExpenseRecord, filters: RankingFilters) {
  if (filters.uf && record.state !== filters.uf) {
    return false;
  }

  if (filters.party && record.party !== filters.party) {
    return false;
  }

  return true;
}

function buildDeputyRanking(records: CeapExpenseRecord[], filters: RankingFilters) {
  const deputyMap = new Map<string, DeputySpendingRank & { supplierKeys: Set<string> }>();

  for (const record of records) {
    if (!matchesRankingFilters(record, filters)) {
      continue;
    }

    const deputyKey = record.deputyId ?? `${record.deputyName}-${record.party}-${record.state}`;
    const current = deputyMap.get(deputyKey) ?? {
      deputyId: record.deputyId,
      deputyName: record.deputyName,
      party: record.party,
      state: record.state,
      totalAmount: 0,
      totalNetAmount: 0,
      expenseCount: 0,
      uniqueSuppliers: 0,
      detailsHref: getDeputyDetailsHref(record.deputyId),
      supplierKeys: new Set<string>()
    };

    current.totalAmount += record.amount;
    current.totalNetAmount += record.netAmount;
    current.expenseCount += 1;
    current.supplierKeys.add(getSupplierLookupKey(record.supplierDocument, record.supplierName));
    deputyMap.set(deputyKey, current);
  }

  return [...deputyMap.values()]
    .map(({ supplierKeys, ...item }) => ({
      ...item,
      uniqueSuppliers: supplierKeys.size
    }))
    .filter((item) => {
      if (filters.minSpend !== undefined && item.totalAmount < filters.minSpend) {
        return false;
      }

      if (filters.maxSpend !== undefined && item.totalAmount > filters.maxSpend) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.totalAmount - left.totalAmount);
}

function buildGroupedRanking(records: CeapExpenseRecord[], field: "state" | "party") {
  const grouped = new Map<string, GroupRankingItem>();
  const deputyCountMap = new Map<string, Set<string>>();

  for (const record of records) {
    const label = record[field] ?? `Sem ${field === "state" ? "UF" : "partido"}`;
    const current = grouped.get(label) ?? {
      label,
      totalAmount: 0,
      totalNetAmount: 0,
      deputyCount: 0,
      averageAmount: 0
    };

    current.totalAmount += record.amount;
    current.totalNetAmount += record.netAmount;
    grouped.set(label, current);

    const deputySet = deputyCountMap.get(label) ?? new Set<string>();
    deputySet.add(record.deputyId ?? record.deputyName);
    deputyCountMap.set(label, deputySet);
  }

  return [...grouped.values()]
    .map((item) => {
      const deputyCount = deputyCountMap.get(item.label)?.size ?? 0;

      return {
        ...item,
        deputyCount,
        averageAmount: deputyCount > 0 ? item.totalAmount / deputyCount : item.totalAmount
      };
    })
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 10);
}

function buildSupplierSummaries(records: CeapExpenseRecord[]) {
  const supplierMap = new Map<
    string,
    SupplierSummary & { deputyKeys: Set<string>; categoryTotals: Map<string, number> }
  >();

  for (const record of records) {
    const supplierId = getSupplierLookupKey(record.supplierDocument, record.supplierName);
    const current = supplierMap.get(supplierId) ?? {
      id: supplierId,
      name: record.supplierName,
      document: normalizeSupplierDocument(record.supplierDocument) || record.supplierDocument,
      href: buildSupplierHref(record.supplierDocument, record.supplierName),
      totalAmount: 0,
      totalNetAmount: 0,
      expenseCount: 0,
      deputyCount: 0,
      topCategory: undefined,
      deputyKeys: new Set<string>(),
      categoryTotals: new Map<string, number>()
    };

    current.totalAmount += record.amount;
    current.totalNetAmount += record.netAmount;
    current.expenseCount += 1;
    current.deputyKeys.add(record.deputyId ?? record.deputyName);
    current.categoryTotals.set(
      record.expenseType,
      (current.categoryTotals.get(record.expenseType) ?? 0) + record.amount
    );
    supplierMap.set(supplierId, current);
  }

  return [...supplierMap.values()]
    .map(({ deputyKeys, categoryTotals, ...item }) => ({
      ...item,
      deputyCount: deputyKeys.size,
      topCategory: [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    }))
    .sort((left, right) => right.totalAmount - left.totalAmount);
}

function buildSupplierDetails(records: CeapExpenseRecord[], supplierId: string) {
  const supplierRecords = records
    .filter(
      (record) =>
        getSupplierLookupKey(record.supplierDocument, record.supplierName) === supplierId
    )
    .sort((left, right) => getExpenseSortValue(right) - getExpenseSortValue(left));

  if (supplierRecords.length === 0) {
    return undefined;
  }

  const categories = new Map<string, { category: string; totalAmount: number; expenseCount: number }>();
  const deputies = new Map<
    string,
    {
      deputyId?: string;
      deputyName: string;
      party?: string;
      state?: string;
      totalAmount: number;
      expenseCount: number;
      profileHref?: string;
    }
  >();

  for (const record of supplierRecords) {
    const currentCategory = categories.get(record.expenseType) ?? {
      category: record.expenseType,
      totalAmount: 0,
      expenseCount: 0
    };
    currentCategory.totalAmount += record.amount;
    currentCategory.expenseCount += 1;
    categories.set(record.expenseType, currentCategory);

    const deputyKey = record.deputyId ?? record.deputyName;
    const currentDeputy = deputies.get(deputyKey) ?? {
      deputyId: record.deputyId,
      deputyName: record.deputyName,
      party: record.party,
      state: record.state,
      totalAmount: 0,
      expenseCount: 0,
      profileHref: getDeputyDetailsHref(record.deputyId)
    };
    currentDeputy.totalAmount += record.amount;
    currentDeputy.expenseCount += 1;
    deputies.set(deputyKey, currentDeputy);
  }

  return {
    ...buildSupplierSummaries(supplierRecords)[0],
    categories: [...categories.values()].sort((left, right) => right.totalAmount - left.totalAmount),
    deputies: [...deputies.values()].sort((left, right) => right.totalAmount - left.totalAmount),
    recentExpenses: supplierRecords.slice(0, 50)
  } satisfies SupplierDetails;
}

function buildSupplierRanking(suppliers: SupplierSummary[]): SupplierRankingItem[] {
  return suppliers.slice(0, 12).map((supplier) => ({
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierDocument: supplier.document,
    href: supplier.href,
    totalAmount: supplier.totalAmount,
    expenseCount: supplier.expenseCount,
    deputyCount: supplier.deputyCount
  }));
}

function buildAlerts(records: CeapExpenseRecord[], deputyRanking: DeputySpendingRank[]) {
  const alerts: CeapAlert[] = [];
  const deputyRecordMap = new Map<string, CeapExpenseRecord[]>();

  for (const record of records) {
    const key = record.deputyId ?? record.deputyName;
    const current = deputyRecordMap.get(key) ?? [];
    current.push(record);
    deputyRecordMap.set(key, current);
  }

  for (const deputy of deputyRanking.slice(0, 60)) {
    const key = deputy.deputyId ?? deputy.deputyName;
    const deputyRecords = deputyRecordMap.get(key) ?? [];

    if (deputyRecords.length === 0) {
      continue;
    }

    const bySupplier = buildSupplierSummaries(deputyRecords);
    const topSupplier = bySupplier[0];

    if (
      topSupplier &&
      deputy.totalAmount > 50000 &&
      topSupplier.totalAmount / deputy.totalAmount >= 0.45
    ) {
      alerts.push({
        id: `supplier-concentration-${key}`,
        type: "supplier_concentration",
        severity: topSupplier.totalAmount / deputy.totalAmount >= 0.6 ? "high" : "medium",
        title: `${deputy.deputyName} concentra gastos em um fornecedor`,
        description: `${topSupplier.name} responde por ${Math.round(
          (topSupplier.totalAmount / deputy.totalAmount) * 100
        )}% do gasto analisado (${formatCurrency(topSupplier.totalAmount)}).`,
        href: topSupplier.href
      });
    }

    const monthTotals = new Map<string, number>();

    for (const record of deputyRecords) {
      const monthKey = `${record.year}-${String(record.month).padStart(2, "0")}`;
      monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + record.amount);
    }

    const orderedMonths = [...monthTotals.entries()].sort((left, right) =>
      left[0].localeCompare(right[0])
    );

    if (orderedMonths.length >= 4) {
      const latest = orderedMonths[orderedMonths.length - 1];
      const previous = orderedMonths.slice(-4, -1);
      const previousAverage =
        previous.reduce((total, item) => total + item[1], 0) / previous.length;

      if (
        previousAverage > 0 &&
        latest[1] >= previousAverage * 1.8 &&
        latest[1] - previousAverage >= 15000
      ) {
        alerts.push({
          id: `spending-spike-${key}`,
          type: "spending_spike",
          severity: latest[1] >= previousAverage * 2.5 ? "high" : "medium",
          title: `${deputy.deputyName} teve salto de gasto no último mês`,
          description: `O mês ${latest[0]} soma ${formatCurrency(
            latest[1]
          )}, contra média recente de ${formatCurrency(previousAverage)}.`,
          href: deputy.detailsHref
        });
      }
    }
  }

  return alerts.slice(0, 12);
}

const getCeapRecordsCached = unstable_cache(
  async (): Promise<CachedCeapDataset> => {
    try {
      const [ceapFile, directory] = await Promise.all([
        resolveCeapJson(),
        searchPoliticians({})
      ]);

      const directoryByName = new Map<string, Politician>();

      for (const politician of directory.items.filter((item) => item.source === "camara")) {
        directoryByName.set(slugifySupplierName(politician.name), politician);
      }

      const records = parseCeapRecords(ceapFile.payload, ceapFile.year).map((record) => {
        const directoryMatch = directoryByName.get(slugifySupplierName(record.deputyName));

        return {
          ...record,
          deputyId: record.deputyId ?? directoryMatch?.externalId,
          party: record.party ?? directoryMatch?.party,
          state: record.state ?? directoryMatch?.state
        };
      });

      return {
        year: ceapFile.year,
        preferredYear: ceapFile.preferredYear,
        attemptedYears: ceapFile.attemptedYears,
        records,
        checkedAt: ceapFile.checkedAt,
        sourceUrl: ceapFile.sourceUrl,
        upstreamLastModified: ceapFile.upstreamLastModified,
        status: "ok",
        errorDetails: undefined
      };
    } catch (error) {
      return buildDegradedCeapDataset(error);
    }
  },
  ["politix-ceap-records-v4"],
  {
    revalidate: CEAP_REVALIDATE_SECONDS
  }
);

const getCeapAnalyticsCached = unstable_cache(
  async (): Promise<CeapAnalyticsBase> => {
    const dataset = await getCeapRecordsCached();
    const records = dataset.records;
    const suppliers = buildSupplierSummaries(records);
    const topDeputies = buildDeputyRanking(records, {}).slice(0, 15);
    const ceapSourceDetails =
      dataset.status === "degraded"
        ? dataset.errorDetails ??
          "Nao foi possivel carregar a CEAP agora. O painel segue disponivel com estado vazio."
        : "Arquivo anual consolidado da cota parlamentar, cacheado no app por 6 horas.";

    return {
      year: dataset.year,
      updatedAt: dataset.checkedAt,
      sourceStatus: [
        {
          id: "camara-directory",
          label: "Diretório da Câmara",
          status: "ok",
          sourceUrl: "https://dadosabertos.camara.leg.br/api/v2/deputados",
          checkedAt: dataset.checkedAt,
          updateCadence: "Revalidação no app a cada 1 hora",
          details: "Lista oficial de deputados em exercício via API v2."
        },
        {
          id: "senado-directory",
          label: "Diretório do Senado",
          status: "ok",
          sourceUrl: "https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json",
          checkedAt: dataset.checkedAt,
          updateCadence: "Revalidação no app a cada 1 hora",
          details: "Lista oficial de senadores em exercício."
        },
        {
          id: "ceap-file",
          label: "CEAP anual da Câmara",
          status: dataset.status,
          sourceUrl: dataset.sourceUrl,
          checkedAt: dataset.checkedAt,
          upstreamLastModified: dataset.upstreamLastModified,
          updateCadence: "Atualização diária declarada pela Câmara",
          details: ceapSourceDetails
        }
      ],
      availableStates: Array.from(
        new Set(records.map((record) => record.state).filter((state): state is string => Boolean(state)))
      ).sort(),
      availableParties: Array.from(
        new Set(records.map((record) => record.party).filter((party): party is string => Boolean(party)))
      ).sort(),
      totals: {
        totalAmount: records.reduce((total, record) => total + record.amount, 0),
        totalNetAmount: records.reduce((total, record) => total + record.netAmount, 0),
        expenseCount: records.length,
        deputyCount: new Set(records.map((record) => record.deputyId ?? record.deputyName)).size,
        supplierCount: suppliers.length
      },
      topDeputies,
      topStates: buildGroupedRanking(records, "state"),
      topParties: buildGroupedRanking(records, "party"),
      topSuppliers: buildSupplierRanking(suppliers),
      alerts: buildAlerts(records, topDeputies),
      suppliers
    };
  },
  ["politix-ceap-analytics-v4"],
  {
    revalidate: CEAP_REVALIDATE_SECONDS
  }
);

export async function getCeapAnalytics(filters: RankingFilters = {}) {
  const [analytics, allRecords] = await Promise.all([getCeapAnalyticsCached(), getCeapRecords()]);

  return {
    ...analytics,
    filteredDeputies: buildDeputyRanking(allRecords, filters).slice(0, 20),
    appliedFilters: {
      uf: filters.uf ?? "",
      party: filters.party ?? "",
      minSpend: filters.minSpend,
      maxSpend: filters.maxSpend
    }
  };
}

export async function getCeapRecords() {
  return (await getCeapRecordsCached()).records;
}

export async function getSupplierDetails(supplierId: string) {
  return buildSupplierDetails(await getCeapRecords(), supplierId);
}
