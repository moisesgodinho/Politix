import "server-only";

type BrasilApiCompanyResponse = {
  cnpj: string;
  razao_social: string;
  data_inicio_atividade: string | null;
  descricao_situacao_cadastral: string | null;
};

const DAY_IN_MS = 86_400_000;
const COMPANY_CACHE_SECONDS = 60 * 60 * 24;

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCnpj(value: string) {
  const sanitized = digitsOnly(value).padStart(14, "0");

  return sanitized.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function isValidCnpj(value: string) {
  const cnpj = digitsOnly(value);

  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const digits = cnpj.split("").map(Number);

  const calculateDigit = (base: number[]) => {
    const factors =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const total = base.reduce((sum, digit, index) => sum + digit * factors[index], 0);
    const remainder = total % 11;

    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12));
  const secondDigit = calculateDigit([...digits.slice(0, 12), firstDigit]);

  return digits[12] === firstDigit && digits[13] === secondDigit;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateCompanyAge(
  openedAt: string | null,
  referenceDate: string | null
) {
  const opened = parseDate(openedAt);
  const reference = parseDate(referenceDate);

  if (!opened || !reference || reference.getTime() < opened.getTime()) {
    return {
      ageInDays: null,
      isRecentlyOpened: false
    };
  }

  const ageInDays = Math.floor((reference.getTime() - opened.getTime()) / DAY_IN_MS);

  return {
    ageInDays,
    isRecentlyOpened: ageInDays < 365
  };
}

export function describeCompanyAge(ageInDays: number | null) {
  if (ageInDays === null) {
    return "Datas insuficientes para calcular";
  }

  if (ageInDays < 30) {
    return `${ageInDays} dia${ageInDays === 1 ? "" : "s"}`;
  }

  if (ageInDays < 365) {
    const months = Math.floor(ageInDays / 30);
    const days = ageInDays % 30;

    if (days === 0) {
      return `${months} ${months === 1 ? "mes" : "meses"}`;
    }

    return `${months} ${months === 1 ? "mes" : "meses"} e ${days} dia${days === 1 ? "" : "s"}`;
  }

  const years = Math.floor(ageInDays / 365);
  const months = Math.floor((ageInDays % 365) / 30);

  if (months === 0) {
    return `${years} ano${years === 1 ? "" : "s"}`;
  }

  return `${years} ano${years === 1 ? "" : "s"} e ${months} ${months === 1 ? "mes" : "meses"}`;
}

export async function fetchCompanyFromBrasilApi(cnpj: string) {
  const sanitized = digitsOnly(cnpj);

  if (!isValidCnpj(sanitized)) {
    return null;
  }

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${sanitized}`, {
    next: {
      revalidate: COMPANY_CACHE_SECONDS
    },
    signal: AbortSignal.timeout(10_000)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`BrasilAPI retornou ${response.status}.`);
  }

  return (await response.json()) as BrasilApiCompanyResponse;
}
