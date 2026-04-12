export function normalizeSupplierDocument(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export function slugifySupplierName(value?: string | null) {
  return (value ?? "fornecedor")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function getSupplierLookupKey(document?: string | null, name?: string | null) {
  const normalizedDocument = normalizeSupplierDocument(document);

  if (normalizedDocument) {
    return `doc:${normalizedDocument}`;
  }

  return `name:${slugifySupplierName(name)}`;
}

export function buildSupplierHref(document?: string | null, name?: string | null) {
  return `/fornecedores/${encodeURIComponent(getSupplierLookupKey(document, name))}`;
}
