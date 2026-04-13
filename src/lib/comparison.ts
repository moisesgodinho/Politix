import { getDeputyDetails, searchPoliticians, type DeputyDetails } from "@/lib/politics";
import type { SourceStatus } from "@/lib/ceap";

const ATTENDANCE_REVALIDATE_SECONDS = 6 * 60 * 60;
const ATTENDANCE_PREFERRED_YEAR = new Date().getFullYear();
const ATTENDANCE_MAX_FALLBACK_YEARS = 2;
const VOTES_FILE_BASE =
  "https://dadosabertos.camara.leg.br/arquivos/votacoesVotos/json";

type VoteAttendanceFilePayload = {
  year: number;
  payload: unknown;
  checkedAt: string;
  sourceUrl: string;
  upstreamLastModified?: string;
};

type VoteAttendanceDataset = {
  year: number;
  checkedAt: string;
  sourceUrl: string;
  upstreamLastModified?: string;
  totalTrackedVotes: number;
  deputyVoteCounts: Record<string, number>;
  status: "ok" | "degraded";
  errorDetails?: string;
};

type MemoryCacheEntry<T> = {
  value?: T;
  expiresAt: number;
  pending?: Promise<T>;
};

export type DeputyAttendanceSummary = {
  year: number;
  checkedAt: string;
  totalTrackedVotes: number;
  voteCount: number;
  participationRate: number;
};

export type DeputyComparisonEntry = {
  deputy: DeputyDetails;
  attendance: DeputyAttendanceSummary;
};

export type DeputyComparisonResult = {
  entries: DeputyComparisonEntry[];
  invalidIds: string[];
  sourceStatus: SourceStatus[];
};

const comparisonModuleCache = new Map<string, MemoryCacheEntry<unknown>>();

function unstable_cache<TArgs extends unknown[], TResult>(
  loader: (...args: TArgs) => Promise<TResult>,
  keyParts: string[] = [],
  options?: {
    revalidate?: number;
  }
) {
  return async (...args: TArgs): Promise<TResult> => {
    const cacheKey = JSON.stringify([keyParts, args]);
    const ttlMs = (options?.revalidate ?? ATTENDANCE_REVALIDATE_SECONDS) * 1000;
    const now = Date.now();
    const current = comparisonModuleCache.get(cacheKey);

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

    comparisonModuleCache.set(cacheKey, nextEntry);

    return nextEntry.pending as Promise<TResult>;
  };
}

function buildVotesFileUrl(year: number) {
  return `${VOTES_FILE_BASE}/votacoesVotos-${year}.json`;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function extractTrailingNumericId(value?: string) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return undefined;
  }

  const directDigits = normalizedValue.match(/^\d+$/)?.[0];

  if (directDigits) {
    return directDigits;
  }

  const matchedDigits = normalizedValue.match(/(\d+)(?!.*\d)/)?.[1];
  return matchedDigits || undefined;
}

function extractVoteId(record: Record<string, unknown>) {
  return (
    extractTrailingNumericId(
      pickString(record, ["idVotacao", "codVotacao", "codigoVotacao", "uriVotacao"])
    ) ?? pickString(record, ["uriVotacao"])
  );
}

function extractDeputyId(record: Record<string, unknown>) {
  return extractTrailingNumericId(
    pickString(record, ["idDeputado", "codDeputado", "codigoDeputado", "uriDeputado"])
  );
}

function parseVoteAttendanceDataset(payload: unknown, year: number) {
  const totalVoteIds = new Set<string>();
  const deputyVotes = new Map<string, Set<string>>();

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    const voteId = extractVoteId(record);
    const deputyId = extractDeputyId(record);

    if (voteId && deputyId) {
      totalVoteIds.add(voteId);
      const currentVotes = deputyVotes.get(deputyId) ?? new Set<string>();
      currentVotes.add(voteId);
      deputyVotes.set(deputyId, currentVotes);
    }

    Object.values(record).forEach(visit);
  }

  visit(payload);

  return {
    year,
    totalTrackedVotes: totalVoteIds.size,
    deputyVoteCounts: Object.fromEntries(
      [...deputyVotes.entries()].map(([deputyId, votes]) => [deputyId, votes.size])
    )
  };
}

async function fetchVoteAttendanceJson(year: number): Promise<VoteAttendanceFilePayload> {
  const url = buildVotesFileUrl(year);
  const response = await fetch(url, {
    next: {
      revalidate: ATTENDANCE_REVALIDATE_SECONDS
    }
  });
  const checkedAt = new Date().toISOString();

  if (!response.ok) {
    throw new Error(`Falha ao consultar votacoesVotos ${year}: ${response.status}`);
  }

  const payloadText = await response.text();

  try {
    return {
      year,
      payload: JSON.parse(payloadText) as unknown,
      checkedAt,
      sourceUrl: url,
      upstreamLastModified: response.headers.get("last-modified") ?? undefined
    };
  } catch {
    throw new Error(`Resposta invalida ao consultar votacoesVotos ${year}.`);
  }
}

async function resolveVoteAttendanceJson() {
  const attemptedYears: number[] = [];
  let lastError: unknown;

  for (let offset = 0; offset < ATTENDANCE_MAX_FALLBACK_YEARS; offset += 1) {
    const year = ATTENDANCE_PREFERRED_YEAR - offset;
    attemptedYears.push(year);

    try {
      return await fetchVoteAttendanceJson(year);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Falha ao consultar votacoesVotos (${attemptedYears.join(", ")}).`);
}

function buildDegradedAttendanceDataset(error: unknown): VoteAttendanceDataset {
  return {
    year: ATTENDANCE_PREFERRED_YEAR,
    checkedAt: new Date().toISOString(),
    sourceUrl: buildVotesFileUrl(ATTENDANCE_PREFERRED_YEAR),
    upstreamLastModified: undefined,
    totalTrackedVotes: 0,
    deputyVoteCounts: {},
    status: "degraded",
    errorDetails:
      error instanceof Error
        ? error.message
        : "Nao foi possivel carregar os arquivos oficiais de votacoes."
  };
}

const getVoteAttendanceDatasetCached = unstable_cache(
  async (): Promise<VoteAttendanceDataset> => {
    try {
      const file = await resolveVoteAttendanceJson();
      const parsed = parseVoteAttendanceDataset(file.payload, file.year);

      return {
        ...parsed,
        checkedAt: file.checkedAt,
        sourceUrl: file.sourceUrl,
        upstreamLastModified: file.upstreamLastModified,
        status: "ok",
        errorDetails: undefined
      };
    } catch (error) {
      return buildDegradedAttendanceDataset(error);
    }
  },
  ["politix-deputy-attendance-v1"],
  {
    revalidate: ATTENDANCE_REVALIDATE_SECONDS
  }
);

function buildComparisonSourceStatus(
  checkedAt: string,
  attendanceDataset: VoteAttendanceDataset
): SourceStatus[] {
  return [
    {
      id: "camara-directory",
      label: "Diretorio da Camara",
      status: "ok",
      sourceUrl: "https://dadosabertos.camara.leg.br/api/v2/deputados",
      checkedAt,
      updateCadence: "Revalidacao no app a cada 1 hora",
      details: "Lista oficial usada para popular o seletor de deputados."
    },
    {
      id: "camara-votes",
      label: "Votacoes por deputado",
      status: attendanceDataset.status,
      sourceUrl: attendanceDataset.sourceUrl,
      checkedAt: attendanceDataset.checkedAt,
      upstreamLastModified: attendanceDataset.upstreamLastModified,
      updateCadence: "Arquivo anual oficial revalidado no app a cada 6 horas",
      details:
        attendanceDataset.status === "ok"
          ? `Assiduidade comparada via participacao em votacoes com registro por parlamentar no arquivo ${attendanceDataset.year}.`
          : attendanceDataset.errorDetails ??
            "Nao foi possivel carregar o arquivo oficial de votacoes agora."
    }
  ];
}

export async function getDeputyComparison(ids: string[]): Promise<DeputyComparisonResult> {
  const selectedIds = Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 3)
    )
  );

  if (selectedIds.length === 0) {
    return {
      entries: [],
      invalidIds: [],
      sourceStatus: []
    };
  }

  const [directory, attendanceDataset, deputyResults] = await Promise.all([
    searchPoliticians({ house: "camara" }),
    getVoteAttendanceDatasetCached(),
    Promise.allSettled(selectedIds.map((id) => getDeputyDetails(id)))
  ]);

  const entries: DeputyComparisonEntry[] = [];
  const invalidIds: string[] = [];

  deputyResults.forEach((result, index) => {
    const requestedId = selectedIds[index];

    if (result.status !== "fulfilled") {
      invalidIds.push(requestedId);
      return;
    }

    const deputy = result.value;
    const voteCount = attendanceDataset.deputyVoteCounts[deputy.externalId] ?? 0;
    const totalTrackedVotes = attendanceDataset.totalTrackedVotes;

    entries.push({
      deputy,
      attendance: {
        year: attendanceDataset.year,
        checkedAt: attendanceDataset.checkedAt,
        voteCount,
        totalTrackedVotes,
        participationRate: totalTrackedVotes > 0 ? voteCount / totalTrackedVotes : 0
      }
    });
  });

  return {
    entries,
    invalidIds,
    sourceStatus: buildComparisonSourceStatus(directory.updatedAt, attendanceDataset)
  };
}
