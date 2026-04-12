import Link from "next/link";

import { SourceStatusPanel } from "@/components/source-status";
import { getCeapAnalytics } from "@/lib/ceap";

type SearchParamValue = string | string[] | undefined;

type PageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

function getSearchValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export default async function SuppliersPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = getSearchValue(resolvedSearchParams.q).trim();
  const analytics = await getCeapAnalytics();

  const suppliers = analytics.suppliers.filter((supplier) => {
    if (!query) {
      return true;
    }

    const haystack = normalizeText(
      `${supplier.name} ${supplier.document ?? ""} ${supplier.topCategory ?? ""}`
    );
    return haystack.includes(normalizeText(query));
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
          <div>
            <span className="eyebrow">Fornecedores CEAP</span>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl">
              Quem recebeu, de quais deputados e em quais categorias.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Base agregada a partir do arquivo anual oficial da cota parlamentar da Câmara.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                Fornecedores
              </span>
              <p className="mt-5 text-3xl font-bold text-slate-950">{analytics.totals.supplierCount}</p>
            </div>
            <div className="panel p-5">
              <span className="soft-badge bg-slate-100 text-slate-700">Valor bruto</span>
              <p className="mt-5 text-3xl font-bold text-slate-950">{formatCurrency(analytics.totals.totalAmount)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-6 lg:p-7">
        <form className="grid gap-4 lg:grid-cols-[1fr,auto,auto]" method="GET">
          <input
            className="field"
            defaultValue={query}
            name="q"
            placeholder="Buscar por fornecedor, CNPJ/CPF ou categoria"
            type="search"
          />
          <button className="primary-button" type="submit">
            Buscar
          </button>
          <Link className="secondary-button" href="/fornecedores">
            Limpar
          </Link>
        </form>
      </section>

      <SourceStatusPanel sources={analytics.sourceStatus} />

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Lista</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Fornecedores indexados</h2>
          <p className="mt-2 text-sm text-muted">{suppliers.length} resultado(s)</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.slice(0, 60).map((supplier) => (
            <article
              key={supplier.id}
              className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
            >
              <h3 className="text-xl font-bold text-slate-950">{supplier.name}</h3>
              <p className="mt-1 text-sm text-muted">{supplier.document ?? "Documento não informado"}</p>
              <dl className="mt-5 grid gap-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-muted">Valor bruto</dt>
                  <dd className="mt-1 font-semibold">{formatCurrency(supplier.totalAmount)}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-muted">Deputados</dt>
                  <dd className="mt-1 font-semibold">{supplier.deputyCount}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-muted">Categoria dominante</dt>
                  <dd className="mt-1 break-words font-semibold">{supplier.topCategory ?? "Não informada"}</dd>
                </div>
              </dl>

              <Link className="mt-5 inline-flex text-sm font-semibold text-teal-700 hover:underline" href={supplier.href}>
                Abrir fornecedor
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
