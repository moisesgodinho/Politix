import Link from "next/link";

import { SourceStatusPanel } from "@/components/source-status";
import { getContractsRadar, type RadarAlert, type RadarReasonCode } from "@/lib/radar";

type SearchParamValue = string | string[] | undefined;

type PageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

const REASON_OPTIONS: Array<{ value: RadarReasonCode; label: string }> = [
  { value: "new_company", label: "Empresa recente" },
  { value: "ceap_recurrence", label: "Recorrencia na CEAP" },
  { value: "contract_burst", label: "Muitos contratos recentes" },
  { value: "multi_deputy_multi_body", label: "Recorrencia cruzada" }
];

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

function parseCompactDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));

  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function formatDate(value?: string) {
  if (!value) {
    return "Nao informado";
  }

  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brazilianDateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parsedDate =
    parseCompactDate(value) ??
    (isoDateMatch
      ? new Date(
          Date.UTC(
            Number(isoDateMatch[1]),
            Number(isoDateMatch[2]) - 1,
            Number(isoDateMatch[3]),
            12
          )
        )
      : brazilianDateMatch
        ? new Date(
            Date.UTC(
              Number(brazilianDateMatch[3]),
              Number(brazilianDateMatch[2]) - 1,
              Number(brazilianDateMatch[1]),
              12
            )
          )
        : new Date(value));

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC"
  }).format(parsedDate);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Nao informado";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(parsedDate);
}

function formatCompanyAge(days?: number) {
  if (typeof days !== "number") {
    return "Nao identificado";
  }

  if (days < 30) {
    return `${days} dia(s)`;
  }

  if (days < 365) {
    return `${Math.max(1, Math.round(days / 30))} mes(es)`;
  }

  return `${(days / 365).toFixed(1).replace(".", ",")} ano(s)`;
}

function matchesAlertQuery(alert: RadarAlert, query: string) {
  if (!query) {
    return true;
  }

  const haystack = normalizeText(
    [
      alert.supplierName,
      alert.supplierDocument,
      alert.companyOfficialName,
      alert.companyCity,
      alert.companyState,
      alert.topCategory,
      ...alert.recentContracts.flatMap((contract) => [
        contract.title,
        contract.organName,
        contract.organCity,
        contract.organUf
      ])
    ]
      .filter(Boolean)
      .join(" ")
  );

  return haystack.includes(normalizeText(query));
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-5">
      <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
        {label}
      </span>
      <p className="mt-5 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function InsightPill({
  label,
  tone = "slate"
}: {
  label: string;
  tone?: "accent" | "warning" | "danger" | "slate";
}) {
  const toneClasses = {
    accent: "bg-[var(--accent-soft)] text-[var(--accent-contrast)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return <span className={`soft-badge ${toneClasses[tone]}`}>{label}</span>;
}

export default async function RadarPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = getSearchValue(resolvedSearchParams.q).trim();
  const risk = getSearchValue(resolvedSearchParams.risk);
  const state = getSearchValue(resolvedSearchParams.state);
  const reason = getSearchValue(resolvedSearchParams.reason);
  const radar = await getContractsRadar();

  const riskFilter = risk === "high" || risk === "medium" ? risk : "";
  const reasonFilter = REASON_OPTIONS.some((option) => option.value === reason)
    ? (reason as RadarReasonCode)
    : "";

  const availableStates = Array.from(
    new Set(
      radar.alerts
        .map((alert) => alert.companyState)
        .filter((currentState): currentState is string => Boolean(currentState))
    )
  ).sort();

  const filteredAlerts = radar.alerts.filter((alert) => {
    if (!matchesAlertQuery(alert, query)) {
      return false;
    }

    if (riskFilter && alert.riskLevel !== riskFilter) {
      return false;
    }

    if (state && alert.companyState !== state) {
      return false;
    }

    if (reasonFilter && !alert.reasons.some((currentReason) => currentReason.code === reasonFilter)) {
      return false;
    }

    return true;
  });

  const pncpMatchedCount = radar.alerts.filter((alert) => alert.pncpContractsCount > 0).length;
  const degradedSources = radar.sourceStatus.filter((source) => source.status === "degraded").length;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.15fr,0.85fr] lg:p-8">
          <div>
            <span className="eyebrow">Radar de licitacoes</span>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl">
              Fornecedores da CEAP cruzados com CNPJ, idade da empresa e contratos recentes.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              O radar pega os principais fornecedores da CEAP com CNPJ valido, enriquece com a
              BrasilAPI e consulta contratos atualizados recentemente no PNCP. Quando nao houver
              contrato confirmado na janela recente, o fornecedor ainda pode entrar como
              watchlist por empresa nova ou recorrencia forte na CEAP.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="secondary-button" href="/">
                Voltar ao dashboard
              </Link>
              <Link className="primary-button" href="/fornecedores">
                Explorar fornecedores CEAP
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
              <InsightPill
                label={`Atualizado em ${formatDateTime(radar.updatedAt)}`}
                tone="accent"
              />
              <InsightPill
                label={`Janela PNCP: ${formatDate(radar.windowStart)} a ${formatDate(radar.windowEnd)}`}
              />
              {degradedSources > 0 ? (
                <InsightPill
                  label={`${degradedSources} fonte(s) com degradacao`}
                  tone="warning"
                />
              ) : (
                <InsightPill label="Fontes operacionais" tone="accent" />
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Fornecedores analisados"
              value={String(radar.totals.analyzedSuppliers)}
            />
            <MetricCard label="Alertas gerados" value={String(radar.totals.flaggedSuppliers)} />
            <MetricCard label="Com vinculo no PNCP" value={String(pncpMatchedCount)} />
            <MetricCard
              label="Empresas com ate 2 anos"
              value={String(radar.totals.recentCompanies)}
            />
          </div>
        </div>
      </section>

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Metodologia</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Regras do alerta</h2>
          <p className="mt-2 text-sm text-muted">
            O fornecedor entra no radar quando aparece na CEAP com CNPJ valido e aciona sinais de
            watchlist. O PNCP aumenta a confianca do alerta quando ha contrato recente confirmado.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] bg-slate-50 px-5 py-5">
            <InsightPill label="Empresa recente" tone="warning" />
            <p className="mt-3 text-sm leading-6 text-slate-700">
              CNPJ com ate 2 anos de abertura que ja entrou no recorte atual da CEAP.
            </p>
          </div>
          <div className="rounded-[24px] bg-slate-50 px-5 py-5">
            <InsightPill label="Recorrencia na CEAP" />
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Mesmo fornecedor aparece para varios deputados, mesmo sem contrato recente
              confirmado no PNCP.
            </p>
          </div>
          <div className="rounded-[24px] bg-slate-50 px-5 py-5">
            <InsightPill label="Muitos contratos" tone="danger" />
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Tres ou mais contratos recentes na janela consultada, sugerindo aceleracao.
            </p>
          </div>
          <div className="rounded-[24px] bg-slate-50 px-5 py-5">
            <InsightPill label="Recorrencia cruzada" tone="accent" />
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Mesmo fornecedor aparece para varios deputados na CEAP e tambem para multiplos
              orgaos no PNCP.
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Filtros</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Busca rapida do radar</h2>
          <p className="mt-2 text-sm text-muted">
            Pesquise por fornecedor, CNPJ, orgao, categoria dominante ou UF da empresa.
          </p>
        </div>

        <form className="mt-6 grid gap-4 lg:grid-cols-[2fr,1fr,1fr,1fr,auto,auto]" method="GET">
          <input
            className="field"
            defaultValue={query}
            name="q"
            placeholder="Fornecedor, CNPJ, orgao ou categoria"
            type="search"
          />

          <select className="field" defaultValue={riskFilter} name="risk">
            <option value="">Todos os riscos</option>
            <option value="high">Alto risco</option>
            <option value="medium">Risco medio</option>
          </select>

          <select className="field" defaultValue={reasonFilter} name="reason">
            <option value="">Todas as regras</option>
            {REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select className="field" defaultValue={state} name="state">
            <option value="">Todas as UFs</option>
            {availableStates.map((currentState) => (
              <option key={currentState} value={currentState}>
                {currentState}
              </option>
            ))}
          </select>

          <button className="primary-button" type="submit">
            Aplicar
          </button>

          <Link className="secondary-button" href="/radar">
            Limpar
          </Link>
        </form>
      </section>

      <SourceStatusPanel sources={radar.sourceStatus} />

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Resultados</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Fornecedores sinalizados</h2>
          <p className="mt-2 text-sm text-muted">
            {filteredAlerts.length} alerta(s) apos os filtros. Cada card combina watchlist da CEAP
            com evidencias do CNPJ e, quando existir, contratos recentes do PNCP.
          </p>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {filteredAlerts.map((alert) => (
              <article
                key={alert.supplierId}
                className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-soft"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <InsightPill
                    label={alert.riskLevel === "high" ? "Alto risco" : "Risco medio"}
                    tone={alert.riskLevel === "high" ? "danger" : "warning"}
                  />
                  <InsightPill
                    label={
                      alert.pncpContractsCount > 0
                        ? `${alert.pncpContractsCount} contrato(s) no PNCP`
                        : "Watchlist sem contrato confirmado"
                    }
                    tone={alert.pncpContractsCount > 0 ? "accent" : "slate"}
                  />
                  <InsightPill label={`${alert.ceapDeputyCount} deputado(s) na CEAP`} />
                </div>

                <div className="mt-4">
                  <h3 className="text-2xl font-bold text-slate-950">{alert.supplierName}</h3>
                  <p className="mt-2 text-sm text-muted">
                    {alert.supplierDocument}
                    {alert.companyOfficialName ? ` • ${alert.companyOfficialName}` : ""}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[24px] bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Abertura da empresa
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {formatDate(alert.companyOpenedAt)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Idade: {formatCompanyAge(alert.companyAgeDays)}
                    </p>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Localizacao
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {alert.companyCity ?? "Cidade nao informada"}
                      {alert.companyState ? ` - ${alert.companyState}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Situacao: {alert.companyStatus ?? "Nao informada"}
                    </p>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Total na CEAP
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {formatCurrency(alert.ceapTotalAmount)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {alert.ceapExpenseCount} despesas encontradas
                    </p>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Recorrencia publica
                    </p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {alert.publicBodyCount} orgao(s) no PNCP
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Categoria dominante: {alert.topCategory ?? "Nao identificada"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Motivos do alerta
                  </p>
                  <div className="mt-3 grid gap-3">
                    {alert.reasons.map((currentReason) => (
                      <div
                        key={currentReason.code}
                        className="rounded-[22px] border border-slate-200/80 bg-slate-50 px-4 py-4"
                      >
                        <p className="font-semibold text-slate-950">{currentReason.label}</p>
                        <p className="mt-1 text-sm text-muted">{currentReason.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Contratos recentes no PNCP
                    </p>
                    <p className="text-sm text-muted">
                      Score de risco {alert.riskScore}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3">
                    {alert.recentContracts.map((contract, index) => (
                      <div
                        key={contract.id ?? `${alert.supplierId}-${index}`}
                        className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">{contract.title}</p>
                            <p className="mt-1 text-sm text-muted">
                              {contract.organName ?? "Orgao nao informado"}
                              {contract.organCity || contract.organUf
                                ? ` • ${[contract.organCity, contract.organUf].filter(Boolean).join(" - ")}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-950">
                              {typeof contract.totalAmount === "number"
                                ? formatCurrency(contract.totalAmount)
                                : "Valor nao informado"}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                              {formatDate(contract.publishedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {alert.recentContracts.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-4">
                        <p className="font-semibold text-slate-950">
                          Nenhum contrato recente confirmado no PNCP
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          Este alerta continua visivel porque o fornecedor acionou sinais de
                          watchlist na CEAP ou pela idade do CNPJ.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link className="primary-button" href={alert.supplierHref}>
                    Abrir fornecedor CEAP
                  </Link>
                  <Link
                    className="secondary-button"
                    href={`/fornecedores?q=${encodeURIComponent(alert.supplierDocument)}`}
                  >
                    Buscar no catalogo
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-10 text-center">
            <h3 className="text-xl font-bold text-slate-950">Nenhum alerta para este filtro</h3>
            <p className="mt-2 text-sm text-muted">
              Isso pode significar que nenhuma watchlist da CEAP combinou com os filtros atuais ou
              que alguma fonte externa esta indisponivel no momento.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
