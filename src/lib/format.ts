const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium"
});

const longDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short"
});

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

export function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Nao informado";
  }

  return currencyFormatter.format(value);
}

export function formatDate(value: string | null | undefined) {
  const parsed = parseDate(value);

  return parsed ? shortDateFormatter.format(parsed) : "";
}

export function formatLongDateTime(value: string | null | undefined) {
  const parsed = parseDate(value);

  return parsed ? longDateTimeFormatter.format(parsed) : "Nao informado";
}
