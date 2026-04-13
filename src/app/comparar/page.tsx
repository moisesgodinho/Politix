import Link from "next/link";

import { SourceStatusPanel } from "@/components/source-status";
import { getDeputyComparison } from "@/lib/comparison";
import { searchPoliticians } from "@/lib/politics";

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

function formatPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

function getComparisonGridClass(itemCount: number) {
  if (itemCount <= 1) {
    return "grid-cols-1";
  }

  if (itemCount === 2) {
    return "md:grid-cols-2";
  }

  return "md:grid-cols-2 xl:grid-cols-3";
}

function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
      <h3 className="text-xl font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

export default async function ComparePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedIds = [
    getSearchValue(resolvedSearchParams.a),
    getSearchValue(resolvedSearchParams.b),
    getSearchValue(resolvedSearchParams.c)
  ].filter(Boolean);

  const directory = await searchPoliticians({ house: "camara" });
  const deputies = [...directory.items]
    .filter((item) => item.source === "camara")
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const comparison = selectedIds.length > 0 ? await getDeputyComparison(selectedIds) : undefined;
  const entries = comparison?.entries ?? [];
  const metrics = [
    {
      label: "Gasto bruto",
      values: entries.map((entry) => formatCurrency(entry.deputy.expenseSummary.totalAmount))
    },
    {
      label: "Gasto liquido",
      values: entries.map((entry) => formatCurrency(entry.deputy.expenseSummary.totalNetAmount))
    },
    {
      label: "Despesas analisadas",
      values: entries.map((entry) => String(entry.deputy.expenseSummary.count))
    },
    {
      label: "Ticket medio",
      values: entries.map((entry) => formatCurrency(entry.deputy.expenseSummary.averageAmount))
    },
    {
      label: "Fornecedores unicos",
      values: entries.map((entry) => String(entry.deputy.expenseSummary.uniqueSuppliers))
    },
    {
      label: "Maior despesa individual",
      values: entries.map((entry) =>
        formatCurrency(entry.deputy.expenseSummary.highestSingleExpenseAmount)
      )
    },
    {
      label: "Fornecedor lider",
      values: entries.map((entry) => entry.deputy.expenseSummary.topSupplierName ?? "Nao identificado")
    },
    {
      label: "Categoria lider",
      values: entries.map((entry) => entry.deputy.expenseSummary.topExpenseType ?? "Nao identificada")
    },
    {
      label: "Assiduidade em votacoes",
      values: entries.map((entry) => formatPercentage(entry.attendance.participationRate))
    },
    {
      label: "Votos registrados",
      values: entries.map(
        (entry) =>
          `${entry.attendance.voteCount}/${entry.attendance.totalTrackedVotes} em ${entry.attendance.year}`
      )
    }
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.15fr,0.85fr] lg:p-8">
          <div>
            <Link className="eyebrow" href="/">
              Voltar para o dashboard
            </Link>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl">
              Comparador de deputados lado a lado
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Selecione 2 ou 3 deputados federais para comparar gasto total, fornecedores,
              categorias e uma leitura de assiduidade baseada na participacao em votacoes com
              registro nominal na Camara.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                Cobertura
              </span>
              <p className="mt-5 text-3xl font-bold text-slate-950">{deputies.length}</p>
              <p className="mt-2 text-sm text-muted">Deputados disponiveis para comparar</p>
            </div>
            <div className="panel p-5">
              <span className="soft-badge bg-slate-100 text-slate-700">Escopo do MVP</span>
              <p className="mt-5 text-3xl font-bold text-slate-950">2 ou 3</p>
              <p className="mt-2 text-sm text-muted">Perfis simultaneos na mesma tela</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Selecao</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Escolha os nomes</h2>
          <p className="mt-2 text-sm text-muted">
            Esta primeira versao foca em deputados federais para manter paridade entre CEAP,
            categorias e votacoes nominais.
          </p>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[1fr,1fr,1fr,auto,auto]" method="GET">
          {(["a", "b", "c"] as const).map((fieldName, index) => (
            <select
              key={fieldName}
              className="field"
              defaultValue={getSearchValue(resolvedSearchParams[fieldName])}
              name={fieldName}
            >
              <option value="">
                {index === 0 ? "Primeiro deputado" : index === 1 ? "Segundo deputado" : "Terceiro deputado"}
              </option>
              {deputies.map((deputy) => (
                <option key={deputy.externalId} value={deputy.externalId}>
                  {deputy.name} • {deputy.party}/{deputy.state}
                </option>
              ))}
            </select>
          ))}

          <button className="primary-button" type="submit">
            Comparar
          </button>

          <Link className="secondary-button" href="/comparar">
            Limpar
          </Link>
        </form>
      </section>

      {comparison && comparison.invalidIds.length > 0 ? (
        <section className="panel p-6 lg:p-7">
          <div className="rounded-[24px] border border-[var(--warning)]/20 bg-[var(--warning-soft)] px-5 py-5 text-sm text-slate-800">
            Alguns IDs selecionados nao puderam ser carregados: {comparison.invalidIds.join(", ")}.
          </div>
        </section>
      ) : null}

      {entries.length >= 2 ? (
        <>
          <section className={`grid gap-6 ${getComparisonGridClass(entries.length)}`}>
            {entries.map((entry) => (
              <article
                key={entry.deputy.externalId}
                className="panel overflow-hidden"
              >
                <div className="p-6 lg:p-7">
                  <div className="flex items-start gap-4">
                    {entry.deputy.photoUrl ? (
                      <img
                        alt={`Foto de ${entry.deputy.name}`}
                        className="h-20 w-20 rounded-[24px] border border-slate-200/80 object-cover"
                        src={entry.deputy.photoUrl}
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-slate-100 text-2xl font-bold text-slate-500">
                        {entry.deputy.name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                          {entry.deputy.party}
                        </span>
                        <span className="soft-badge bg-slate-100 text-slate-700">
                          {entry.deputy.state}
                        </span>
                      </div>

                      <h2 className="mt-3 text-2xl font-bold text-slate-950">
                        {entry.deputy.name}
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {entry.deputy.status ?? "Em exercicio"} • Legislatura{" "}
                        {entry.deputy.legislature ?? "atual"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[22px] bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        Gasto bruto
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-950">
                        {formatCurrency(entry.deputy.expenseSummary.totalAmount)}
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        Fornecedores
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-950">
                        {entry.deputy.expenseSummary.uniqueSuppliers}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-white/95 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                        Assiduidade em votacoes
                      </p>
                      <p className="text-lg font-bold text-slate-950">
                        {formatPercentage(entry.attendance.participationRate)}
                      </p>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-teal-700"
                        style={{
                          width: `${Math.max(0, Math.min(100, entry.attendance.participationRate * 100))}%`
                        }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-muted">
                      {entry.attendance.voteCount} de {entry.attendance.totalTrackedVotes} votacoes
                      com registro parlamentar no arquivo {entry.attendance.year}.
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      className="secondary-button"
                      href={`/deputados/${entry.deputy.externalId}`}
                    >
                      Abrir perfil
                    </Link>
                    <Link
                      className="secondary-button"
                      href={`/partidos/${encodeURIComponent(entry.deputy.party)}`}
                    >
                      Ver partido
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="panel p-6 lg:p-7">
            <div className="border-b border-slate-200/80 pb-5">
              <span className="eyebrow">Matriz</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950">
                Indicadores comparados na mesma tabela
              </h2>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Indicador
                    </th>
                    {entries.map((entry) => (
                      <th
                        key={entry.deputy.externalId}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted"
                      >
                        {entry.deputy.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => (
                    <tr key={metric.label}>
                      <td className="rounded-l-[20px] bg-slate-50 px-4 py-4 font-semibold text-slate-950">
                        {metric.label}
                      </td>
                      {metric.values.map((value, index) => (
                        <td
                          key={`${metric.label}-${entries[index]?.deputy.externalId ?? index}`}
                          className={`bg-white px-4 py-4 text-sm text-slate-700 ${
                            index === metric.values.length - 1 ? "rounded-r-[20px]" : ""
                          }`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`grid gap-6 ${getComparisonGridClass(entries.length)}`}>
            {entries.map((entry) => (
              <section
                key={`${entry.deputy.externalId}-suppliers`}
                className="panel p-6 lg:p-7"
              >
                <div className="border-b border-slate-200/80 pb-5">
                  <span className="eyebrow">Fornecedores</span>
                  <h2 className="mt-3 text-2xl font-bold text-slate-950">
                    {entry.deputy.name}
                  </h2>
                </div>

                <div className="mt-6 space-y-4">
                  {entry.deputy.topSuppliers.slice(0, 5).map((supplier) => (
                    <div
                      key={`${entry.deputy.externalId}-${supplier.label}`}
                      className="rounded-[24px] bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-950">{supplier.label}</span>
                        <span className="font-bold text-slate-950">
                          {formatCurrency(supplier.totalAmount)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {supplier.expenseCount} despesas no recorte carregado
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </section>

          <section className={`grid gap-6 ${getComparisonGridClass(entries.length)}`}>
            {entries.map((entry) => (
              <section
                key={`${entry.deputy.externalId}-categories`}
                className="panel p-6 lg:p-7"
              >
                <div className="border-b border-slate-200/80 pb-5">
                  <span className="eyebrow">Categorias</span>
                  <h2 className="mt-3 text-2xl font-bold text-slate-950">
                    {entry.deputy.name}
                  </h2>
                </div>

                <div className="mt-6 space-y-4">
                  {entry.deputy.expenseCategories.slice(0, 5).map((category) => (
                    <div
                      key={`${entry.deputy.externalId}-${category.label}`}
                      className="rounded-[24px] bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-950">{category.label}</span>
                        <span className="font-bold text-slate-950">
                          {formatCurrency(category.totalAmount)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {category.expenseCount} despesas na categoria
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </section>

          <SourceStatusPanel sources={comparison?.sourceStatus ?? []} />
        </>
      ) : (
        <section className="panel p-6 lg:p-7">
          <EmptyState
            title="Selecione ao menos dois deputados"
            description="Use os tres campos acima para montar uma comparacao lado a lado. O terceiro nome e opcional."
          />
        </section>
      )}
    </main>
  );
}
