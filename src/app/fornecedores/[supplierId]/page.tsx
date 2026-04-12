import Link from "next/link";
import { notFound } from "next/navigation";

import { SourceStatusPanel } from "@/components/source-status";
import { getCeapAnalytics, getSupplierDetails } from "@/lib/ceap";

type SupplierPageProps = {
  params: Promise<{
    supplierId: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) {
    return "Nao informado";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(parsedDate);
}

function buildExpenseRowKey(
  expense: Awaited<ReturnType<typeof getSupplierDetails>> extends infer T
    ? T extends { recentExpenses: Array<infer U> }
      ? U
      : never
    : never,
  index: number
) {
  return [
    expense.documentNumber,
    expense.documentDate,
    expense.deputyId,
    expense.deputyName,
    expense.expenseType,
    expense.amount,
    index
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join("|");
}

export default async function SupplierDetailsPage({ params }: SupplierPageProps) {
  const { supplierId } = await params;
  const [analytics, supplier] = await Promise.all([
    getCeapAnalytics(),
    getSupplierDetails(decodeURIComponent(supplierId))
  ]);

  if (!supplier) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
          <div>
            <span className="eyebrow">Fornecedor CEAP</span>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl">
              {supplier.name}
            </h1>
            <p className="mt-4 text-base text-muted">
              {supplier.document ?? "Documento nao informado"} • {supplier.deputyCount} deputados
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="secondary-button" href="/fornecedores">
                Voltar para fornecedores
              </Link>
              <Link className="primary-button" href="/">
                Voltar ao dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                Valor bruto
              </span>
              <p className="mt-5 text-3xl font-bold text-slate-950">
                {formatCurrency(supplier.totalAmount)}
              </p>
            </div>
            <div className="panel p-5">
              <span className="soft-badge bg-slate-100 text-slate-700">Despesas</span>
              <p className="mt-5 text-3xl font-bold text-slate-950">{supplier.expenseCount}</p>
            </div>
          </div>
        </div>
      </section>

      <SourceStatusPanel sources={analytics.sourceStatus} />

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Deputados</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              Quem pagou este fornecedor
            </h2>
          </div>
          <div className="mt-6 space-y-4">
            {supplier.deputies.map((deputy) => (
              <article
                key={`${deputy.deputyId ?? deputy.deputyName}`}
                className="rounded-[24px] bg-slate-50 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">{deputy.deputyName}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {deputy.party ?? "Sem partido"} • {deputy.state ?? "Sem UF"} •{" "}
                      {deputy.expenseCount} despesas
                    </p>
                  </div>
                  <span className="font-bold text-slate-950">
                    {formatCurrency(deputy.totalAmount)}
                  </span>
                </div>
                {deputy.profileHref ? (
                  <Link
                    className="mt-3 inline-flex text-sm font-semibold text-teal-700 hover:underline"
                    href={deputy.profileHref}
                  >
                    Abrir deputado
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Categorias</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              Em quais tipos de despesa
            </h2>
          </div>
          <div className="mt-6 space-y-4">
            {supplier.categories.map((category) => (
              <div key={category.category} className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-950">{category.category}</span>
                  <span className="font-bold text-slate-950">
                    {formatCurrency(category.totalAmount)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{category.expenseCount} despesas</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Historico recente</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">
            Ultimas despesas encontradas
          </h2>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200/80">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80 bg-white">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Deputado</th>
                  <th className="px-4 py-4">Categoria</th>
                  <th className="px-4 py-4">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {supplier.recentExpenses.map((expense, index) => (
                  <tr
                    key={buildExpenseRowKey(expense, index)}
                    className="text-sm text-slate-700"
                  >
                    <td className="px-4 py-4">{formatDate(expense.documentDate)}</td>
                    <td className="px-4 py-4">
                      {expense.deputyName}
                      <p className="mt-1 text-xs text-muted">
                        {expense.party ?? "Sem partido"} • {expense.state ?? "Sem UF"}
                      </p>
                    </td>
                    <td className="px-4 py-4">{expense.expenseType}</td>
                    <td className="px-4 py-4 font-semibold text-slate-950">
                      {formatCurrency(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
