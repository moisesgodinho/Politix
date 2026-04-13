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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-5">
      <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
        {label}
      </span>
      <p className="mt-5 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const uf = getSearchValue(resolvedSearchParams.uf);
  const party = getSearchValue(resolvedSearchParams.party);
  const minSpend = Number(getSearchValue(resolvedSearchParams.minSpend) || 0) || undefined;
  const maxSpend = Number(getSearchValue(resolvedSearchParams.maxSpend) || 0) || undefined;

  const analytics = await getCeapAnalytics({
    uf,
    party,
    minSpend,
    maxSpend
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
          <div>
            <span className="eyebrow">Insights CEAP {analytics.year}</span>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl">
              Rankings, alertas simples e confiança da fonte em uma camada só.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Este painel trabalha sobre o arquivo anual oficial da CEAP da Câmara para gerar
              rankings por deputado, partido, UF e fornecedores recorrentes.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="primary-button" href="/fornecedores">
                Explorar fornecedores
              </Link>
              <Link className="secondary-button" href="/">
                Voltar ao dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard label="Valor bruto" value={formatCurrency(analytics.totals.totalAmount)} />
            <SummaryCard label="Despesas" value={String(analytics.totals.expenseCount)} />
            <SummaryCard label="Deputados" value={String(analytics.totals.deputyCount)} />
            <SummaryCard label="Fornecedores" value={String(analytics.totals.supplierCount)} />
          </div>
        </div>
      </section>

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Filtros avancados</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Ranking por UF, partido e faixa</h2>
          <p className="mt-2 text-sm text-muted">
            Casa legislativa do recorte atual: Câmara dos Deputados. Presença e comissões entram na
            próxima integração.
          </p>
        </div>

        <form className="mt-6 grid gap-4 lg:grid-cols-[1fr,1fr,1fr,1fr,auto,auto]" method="GET">
          <select className="field" defaultValue={analytics.appliedFilters.uf} name="uf">
            <option value="">Todas as UFs</option>
            {analytics.availableStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>

          <select className="field" defaultValue={analytics.appliedFilters.party} name="party">
            <option value="">Todos os partidos</option>
            {analytics.availableParties.map((currentParty) => (
              <option key={currentParty} value={currentParty}>
                {currentParty}
              </option>
            ))}
          </select>

          <input
            className="field"
            defaultValue={analytics.appliedFilters.minSpend ?? ""}
            min="0"
            name="minSpend"
            placeholder="Gasto mínimo"
            type="number"
          />

          <input
            className="field"
            defaultValue={analytics.appliedFilters.maxSpend ?? ""}
            min="0"
            name="maxSpend"
            placeholder="Gasto máximo"
            type="number"
          />

          <button className="primary-button" type="submit">
            Aplicar
          </button>

          <Link className="secondary-button" href="/insights">
            Limpar
          </Link>
        </form>
      </section>

      <SourceStatusPanel sources={analytics.sourceStatus} />

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Ranking filtrado</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Maiores gastos por deputado</h2>
          </div>

          <div className="mt-6 space-y-4">
            {analytics.filteredDeputies.map((deputy, index) => (
              <article
                key={`${deputy.deputyId ?? deputy.deputyName}-${index}`}
                className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      #{index + 1}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-slate-950">{deputy.deputyName}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {deputy.party ?? "Sem partido"} • {deputy.state ?? "Sem UF"} •{" "}
                      {deputy.uniqueSuppliers} fornecedores
                    </p>
                  </div>
                  <p className="text-lg font-bold text-slate-950">
                    {formatCurrency(deputy.totalAmount)}
                  </p>
                </div>

                {deputy.detailsHref ? (
                  <Link className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:underline" href={deputy.detailsHref}>
                    Abrir deputado
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Alertas simples</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Padrões que merecem revisão</h2>
          </div>

          <div className="mt-6 space-y-4">
            {analytics.alerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`soft-badge ${
                      alert.severity === "high"
                        ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {alert.severity === "high" ? "Alta" : "Média"}
                  </span>
                  <span className="text-xs uppercase tracking-[0.16em] text-muted">
                    {alert.type === "spending_spike" ? "Salto de gasto" : "Concentração"}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-slate-950">{alert.title}</h3>
                <p className="mt-2 text-sm text-muted">{alert.description}</p>
                {alert.href ? (
                  <Link className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:underline" href={alert.href}>
                    Investigar
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">UF</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Estados com maior gasto</h2>
          </div>
          <div className="mt-6 space-y-4">
            {analytics.topStates.map((item) => (
              <div key={item.label} className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-950">{item.label}</span>
                  <span className="font-bold text-slate-950">{formatCurrency(item.totalAmount)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{item.deputyCount} deputados no recorte</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Partidos</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Partidos com maior gasto</h2>
          </div>
          <div className="mt-6 space-y-4">
            {analytics.topParties.map((item) => (
              <Link
                key={item.label}
                className="block rounded-[24px] bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                href={`/partidos/${encodeURIComponent(item.label)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-950">{item.label}</span>
                  <span className="font-bold text-slate-950">{formatCurrency(item.totalAmount)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Média por deputado: {formatCurrency(item.averageAmount)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Fornecedores</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Mais recorrentes</h2>
          </div>
          <div className="mt-6 space-y-4">
            {analytics.topSuppliers.map((supplier) => (
              <article key={supplier.supplierId} className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Link className="font-semibold text-slate-950 hover:text-teal-700" href={supplier.href}>
                      {supplier.supplierName}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {supplier.deputyCount} deputados • {supplier.expenseCount} despesas
                    </p>
                  </div>
                  <span className="font-bold text-slate-950">{formatCurrency(supplier.totalAmount)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
