"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { buildSupplierHref } from "@/lib/suppliers";

type DeputyExpense = {
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

type DeputyExpenseChartsProps = {
  expenses: DeputyExpense[];
};

type SeriesPoint = {
  key: string;
  label: string;
  shortLabel: string;
  totalAmount: number;
  totalNetAmount: number;
  expenseCount: number;
};

const COLORS = {
  primary: "#0f766e",
  primarySoft: "#9dd7d1",
  warning: "#f59e0b",
  warningSoft: "#fde68a",
  slate: "#1e293b",
  slateSoft: "#cbd5e1"
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

function formatMonthLabel(month?: number, year?: number) {
  if (!month || !year) {
    return "Sem periodo";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit"
  }).format(new Date(year, month - 1, 1));
}

function truncateLabel(label: string, maxLength: number) {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function matchesFilters(
  expense: DeputyExpense,
  selectedMonth: string | null,
  selectedCategory: string | null
) {
  const expenseMonthKey =
    expense.year && expense.month
      ? `${expense.year}-${String(expense.month).padStart(2, "0")}`
      : null;

  const matchesMonth = !selectedMonth || expenseMonthKey === selectedMonth;
  const matchesCategory = !selectedCategory || expense.expenseType === selectedCategory;

  return matchesMonth && matchesCategory;
}

function buildMonthlySeries(expenses: DeputyExpense[]) {
  const monthlyMap = new Map<string, SeriesPoint & { sortKey: number }>();

  for (const expense of expenses) {
    const year = expense.year ?? 0;
    const month = expense.month ?? 0;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const current = monthlyMap.get(key) ?? {
      key,
      label: formatMonthLabel(month, year),
      shortLabel: formatMonthLabel(month, year),
      totalAmount: 0,
      totalNetAmount: 0,
      expenseCount: 0,
      sortKey: year * 100 + month
    };

    current.totalAmount += expense.amount;
    current.totalNetAmount += expense.netAmount ?? expense.amount;
    current.expenseCount += 1;
    monthlyMap.set(key, current);
  }

  return [...monthlyMap.values()]
    .sort((left, right) => left.sortKey - right.sortKey)
    .map(({ sortKey: _sortKey, ...item }) => item)
    .slice(-12);
}

function buildCategorySeries(expenses: DeputyExpense[]) {
  const categoryMap = new Map<string, SeriesPoint>();

  for (const expense of expenses) {
    const key = expense.expenseType ?? "Categoria nao informada";
    const current = categoryMap.get(key) ?? {
      key,
      label: key,
      shortLabel: truncateLabel(key, 30),
      totalAmount: 0,
      totalNetAmount: 0,
      expenseCount: 0
    };

    current.totalAmount += expense.amount;
    current.totalNetAmount += expense.netAmount ?? expense.amount;
    current.expenseCount += 1;
    categoryMap.set(key, current);
  }

  return [...categoryMap.values()]
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 8);
}

function buildSupplierSeries(expenses: DeputyExpense[]) {
  const supplierMap = new Map<string, SeriesPoint>();

  for (const expense of expenses) {
    const key = expense.supplierDocument ?? expense.supplierName ?? "Fornecedor nao informado";
    const label = expense.supplierName ?? "Fornecedor nao informado";
    const current = supplierMap.get(key) ?? {
      key,
      label,
      shortLabel: truncateLabel(label, 24),
      totalAmount: 0,
      totalNetAmount: 0,
      expenseCount: 0
    };

    current.totalAmount += expense.amount;
    current.totalNetAmount += expense.netAmount ?? expense.amount;
    current.expenseCount += 1;
    supplierMap.set(key, current);
  }

  return [...supplierMap.values()]
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 6);
}

function StatCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-3 break-words text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ChartShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-6 lg:p-7">
      <div className="border-b border-slate-200/80 pb-5">
        <span className="eyebrow">Filtro visual</span>
        <h2 className="mt-3 text-2xl font-bold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      <div className="mt-6 h-[320px] w-full">{children}</div>
    </section>
  );
}

export function DeputyExpenseCharts({ expenses }: DeputyExpenseChartsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedMonth = searchParams.get("month");
  const selectedCategory = searchParams.get("category");
  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    setVisibleCount(25);
  }, [selectedMonth, selectedCategory]);

  function updateFilters(nextFilters: {
    month?: string | null;
    category?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const month =
      Object.prototype.hasOwnProperty.call(nextFilters, "month")
        ? nextFilters.month
        : selectedMonth;
    const category =
      Object.prototype.hasOwnProperty.call(nextFilters, "category")
        ? nextFilters.category
        : selectedCategory;

    if (month) {
      params.set("month", month);
    } else {
      params.delete("month");
    }

    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false
    });
  }

  function toggleMonth(month: string) {
    updateFilters({
      month: selectedMonth === month ? null : month
    });
  }

  function toggleCategory(category: string) {
    updateFilters({
      category: selectedCategory === category ? null : category
    });
  }

  const sortedExpenses = useMemo(
    () => [...expenses].sort((left, right) => getExpenseSortValue(right) - getExpenseSortValue(left)),
    [expenses]
  );

  const filteredExpenses = useMemo(
    () =>
      sortedExpenses.filter((expense) =>
        matchesFilters(expense, selectedMonth, selectedCategory)
      ),
    [selectedCategory, selectedMonth, sortedExpenses]
  );

  const monthlySeries = useMemo(
    () =>
      buildMonthlySeries(
        sortedExpenses.filter((expense) =>
          matchesFilters(expense, null, selectedCategory)
        )
      ),
    [selectedCategory, sortedExpenses]
  );

  const categorySeries = useMemo(
    () =>
      buildCategorySeries(
        sortedExpenses.filter((expense) =>
          matchesFilters(expense, selectedMonth, null)
        )
      ),
    [selectedMonth, sortedExpenses]
  );

  const supplierSeries = useMemo(
    () => buildSupplierSeries(filteredExpenses),
    [filteredExpenses]
  );

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonth) {
      return null;
    }

    return (
      monthlySeries.find((entry) => entry.key === selectedMonth)?.label ?? selectedMonth
    );
  }, [monthlySeries, selectedMonth]);

  const filteredSummary = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((total, item) => total + item.amount, 0);
    const totalNetAmount = filteredExpenses.reduce(
      (total, item) => total + (item.netAmount ?? item.amount),
      0
    );
    const topSupplier = supplierSeries[0];
    const topCategory = buildCategorySeries(filteredExpenses)[0];

    return {
      count: filteredExpenses.length,
      totalAmount,
      totalNetAmount,
      averageAmount: filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0,
      topSupplier: topSupplier ? `${topSupplier.label} (${formatCurrency(topSupplier.totalAmount)})` : "Nao informado",
      topCategory: topCategory ? `${topCategory.label} (${formatCurrency(topCategory.totalAmount)})` : "Nao informado"
    };
  }, [filteredExpenses, supplierSeries]);

  const visibleExpenses = filteredExpenses.slice(0, visibleCount);

  return (
    <section className="flex flex-col gap-6">
      <section className="panel p-6 lg:p-7">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow">Explorador de despesas</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Filtre por categoria e mês</h2>
            <p className="mt-2 text-sm text-muted">
              Carregadas {expenses.length} despesas recentes da API da Câmara. Clique nos gráficos
              para refinar a análise sem recarregar a página.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedMonth ? (
              <button
                className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]"
                onClick={() => updateFilters({ month: null })}
                type="button"
              >
                Mês: {selectedMonthLabel} ×
              </button>
            ) : null}
            {selectedCategory ? (
              <button
                className="soft-badge bg-[var(--warning-soft)] text-[var(--warning)]"
                onClick={() => updateFilters({ category: null })}
                type="button"
              >
                Categoria: {selectedCategory} ×
              </button>
            ) : null}
            {selectedMonth || selectedCategory ? (
              <button
                className="secondary-button h-10 px-4"
                onClick={() =>
                  updateFilters({
                    month: null,
                    category: null
                  })
                }
                type="button"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Despesas filtradas" value={String(filteredSummary.count)} />
          <StatCard label="Valor bruto" value={formatCurrency(filteredSummary.totalAmount)} />
          <StatCard label="Valor liquido" value={formatCurrency(filteredSummary.totalNetAmount)} />
          <StatCard label="Ticket medio" value={formatCurrency(filteredSummary.averageAmount)} />
          <StatCard label="Maior fornecedor" value={filteredSummary.topSupplier} />
          <StatCard label="Maior destaque" value={filteredSummary.topCategory} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartShell
          title="Filtro por mês"
          description="Clique em uma barra para manter apenas aquele mês. Se uma categoria já estiver ativa, o gráfico mostra sua evolução mensal."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlySeries}>
              <CartesianGrid stroke="#dbe4ea" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortLabel" stroke="#5d6b76" tickLine={false} axisLine={false} />
              <YAxis
                stroke="#5d6b76"
                tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`}
                tickLine={false}
                axisLine={false}
                width={58}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(_label, payload) => payload?.[0]?.payload?.label ?? "Periodo"}
                contentStyle={{
                  borderRadius: 18,
                  border: "1px solid rgba(16, 35, 49, 0.09)"
                }}
              />
              <Bar dataKey="totalAmount" radius={[10, 10, 0, 0]}>
                {monthlySeries.map((entry) => (
                  <Cell
                    key={entry.key}
                    cursor="pointer"
                    fill={selectedMonth === entry.key ? COLORS.primary : COLORS.primarySoft}
                    onClick={() => toggleMonth(entry.key)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Categorias da CEAP"
          description="Agora as legendas ficam estáveis em barras horizontais. Clique em uma categoria para filtrar a tabela e os totais."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categorySeries} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid stroke="#dbe4ea" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                stroke="#5d6b76"
                tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortLabel"
                width={170}
                stroke="#5d6b76"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(_label, payload) => payload?.[0]?.payload?.label ?? "Categoria"}
                contentStyle={{
                  borderRadius: 18,
                  border: "1px solid rgba(16, 35, 49, 0.09)"
                }}
              />
              <Bar dataKey="totalAmount" radius={[0, 10, 10, 0]}>
                {categorySeries.map((entry) => (
                  <Cell
                    key={entry.key}
                    cursor="pointer"
                    fill={selectedCategory === entry.key ? COLORS.warning : COLORS.warningSoft}
                    onClick={() => toggleCategory(entry.key)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      <ChartShell
        title="Fornecedores no recorte atual"
        description="Este gráfico já respeita os filtros aplicados por mês e categoria."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={supplierSeries} layout="vertical" margin={{ left: 12, right: 12 }}>
            <CartesianGrid stroke="#dbe4ea" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              stroke="#5d6b76"
              tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              width={170}
              stroke="#5d6b76"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.label ?? "Fornecedor"}
              contentStyle={{
                borderRadius: 18,
                border: "1px solid rgba(16, 35, 49, 0.09)"
              }}
            />
            <Bar dataKey="totalAmount" fill={COLORS.slate} radius={[0, 10, 10, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <section className="panel p-6 lg:p-7">
        <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Tabela filtrada</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Despesas detalhadas</h2>
          </div>
          <p className="text-sm text-muted">
            Mostrando {Math.min(visibleExpenses.length, filteredExpenses.length)} de{" "}
            {filteredExpenses.length} despesa(s) no recorte atual.
          </p>
        </div>

        {filteredExpenses.length > 0 ? (
          <>
            <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200/80">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200/80 bg-white">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      <th className="px-4 py-4">Data</th>
                      <th className="px-4 py-4">Mês</th>
                      <th className="px-4 py-4">Fornecedor</th>
                      <th className="px-4 py-4">Categoria</th>
                      <th className="px-4 py-4">Valor</th>
                      <th className="px-4 py-4">Liquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {visibleExpenses.map((expense, index) => (
                      <tr
                        key={`${expense.documentNumber ?? "doc"}-${expense.documentDate ?? index}`}
                        className="text-sm text-slate-700"
                      >
                        <td className="px-4 py-4">{formatDate(expense.documentDate)}</td>
                        <td className="px-4 py-4">{formatMonthLabel(expense.month, expense.year)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <Link
                              className="font-semibold text-slate-950 hover:text-teal-700"
                              href={buildSupplierHref(expense.supplierDocument, expense.supplierName)}
                            >
                              {expense.supplierName ?? "Nao informado"}
                            </Link>
                            <span className="text-xs text-muted">
                              {expense.supplierDocument ?? "Documento nao informado"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            className="text-left font-semibold text-teal-700 hover:underline"
                            onClick={() =>
                              toggleCategory(expense.expenseType ?? "Categoria nao informada")
                            }
                            type="button"
                          >
                            {expense.expenseType ?? "Categoria nao informada"}
                          </button>
                          <p className="mt-1 text-xs text-muted">
                            {expense.documentType ?? "Tipo nao informado"}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-950">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-950">
                              {formatCurrency(expense.netAmount ?? expense.amount)}
                            </span>
                            {expense.documentUrl ? (
                              <a
                                className="text-xs font-semibold text-teal-700 hover:underline"
                                href={expense.documentUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Documento
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {visibleCount < filteredExpenses.length ? (
              <div className="mt-5 flex justify-center">
                <button
                  className="secondary-button"
                  onClick={() => setVisibleCount((current) => current + 25)}
                  type="button"
                >
                  Mostrar mais 25 despesas
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-10 text-center">
            <h3 className="text-xl font-bold text-slate-950">Nenhuma despesa neste recorte</h3>
            <p className="mt-2 text-sm text-muted">
              Limpe um dos filtros ou selecione outra categoria/mês no gráfico.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
