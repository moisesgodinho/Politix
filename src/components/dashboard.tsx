import Link from "next/link";

import type { Politician, PoliticianSearchResult } from "@/lib/politics";

type DashboardProps = {
  data: PoliticianSearchResult;
};

function SummaryCard({
  label,
  value,
  tone = "accent"
}: {
  label: string;
  value: string;
  tone?: "accent" | "warning" | "slate";
}) {
  const toneClasses = {
    accent: "bg-[var(--accent-soft)] text-[var(--accent-contrast)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    slate: "bg-slate-100 text-slate-700"
  };

  return (
    <div className="panel p-5">
      <span className={`soft-badge ${toneClasses[tone]}`}>{label}</span>
      <p className="mt-5 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(parsedDate);
}

function ResultsHeader({
  matchingCount,
  filters
}: Pick<PoliticianSearchResult, "matchingCount" | "filters">) {
  const hasFilters = Boolean(
    filters.query || filters.state || filters.city || filters.party || filters.house
  );

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Politicos monitorados</h2>
        <p className="mt-1 text-sm text-muted">
          {matchingCount} resultado(s)
          {hasFilters ? " para o filtro aplicado." : " carregados do diretorio oficial consolidado."}
        </p>
      </div>

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {filters.query ? (
            <span className="soft-badge bg-slate-100 text-slate-700">Busca: {filters.query}</span>
          ) : null}
          {filters.state ? (
            <span className="soft-badge bg-slate-100 text-slate-700">UF: {filters.state}</span>
          ) : null}
          {filters.city ? (
            <span className="soft-badge bg-slate-100 text-slate-700">Cidade: {filters.city}</span>
          ) : null}
          {filters.party ? (
            <span className="soft-badge bg-slate-100 text-slate-700">
              Partido: {filters.party}
            </span>
          ) : null}
          {filters.house ? (
            <span className="soft-badge bg-slate-100 text-slate-700">
              Casa: {filters.house === "camara" ? "Camara" : "Senado"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PoliticianCard({ politician }: { politician: Politician }) {
  const deputyDetailsHref =
    politician.source === "camara" ? `/deputados/${politician.externalId}` : undefined;

  return (
    <article className="rounded-[24px] border border-slate-200/70 bg-white/95 p-5 transition hover:-translate-y-0.5 hover:border-teal-700/20 hover:shadow-lg">
      <div className="flex items-start gap-4">
        {politician.photoUrl ? (
          <img
            alt={`Foto de ${politician.name}`}
            className="h-16 w-16 rounded-2xl border border-slate-200/70 object-cover"
            src={politician.photoUrl}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-500">
            {politician.name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
              {politician.office}
            </span>
            <span className="soft-badge bg-slate-100 text-slate-700">
              {politician.sourceLabel}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-bold text-slate-950">{politician.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {politician.party} • {politician.state}
            {politician.city ? ` • ${politician.city}` : ""}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 text-sm text-slate-700">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-muted">Status</dt>
          <dd className="text-right font-semibold">{politician.status ?? "Em exercicio"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-muted">Legislatura</dt>
          <dd className="text-right font-semibold">{politician.legislature ?? "Atual"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-muted">Contato</dt>
          <dd className="min-w-0 max-w-[13rem] text-right font-semibold">
            {politician.email ? (
              <a
                className="break-all text-teal-700 hover:underline"
                href={`mailto:${politician.email}`}
              >
                {politician.email}
              </a>
            ) : (
              "Nao informado"
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-muted">
          ID {politician.externalId}
        </span>
        <div className="flex items-center gap-3">
          {deputyDetailsHref ? (
            <Link
              className="text-sm font-semibold text-slate-950 transition hover:text-teal-800"
              href={deputyDetailsHref}
            >
              Ver detalhes
            </Link>
          ) : null}
          {politician.profileUrl ? (
            <a
              className="text-sm font-semibold text-teal-700 transition hover:text-teal-800"
              href={politician.profileUrl}
              rel="noreferrer"
              target="_blank"
            >
              Abrir perfil oficial
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SourceStatusCard({
  source
}: {
  source: PoliticianSearchResult["sourceStatus"][number];
}) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-950">{source.label}</h3>
        <span
          className={`soft-badge ${
            source.status === "ok"
              ? "bg-[var(--accent-soft)] text-[var(--accent-contrast)]"
              : "bg-[var(--warning-soft)] text-[var(--warning)]"
          }`}
        >
          {source.status === "ok" ? "Operacional" : "Atencao"}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm text-slate-700">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">App verificado em</dt>
          <dd className="mt-1 font-semibold">{formatDateTime(source.checkedAt)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">Cadencia</dt>
          <dd className="mt-1 font-semibold">{source.updateCadence ?? "Nao informado"}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">Fonte oficial</dt>
          <dd className="mt-1 break-all font-semibold">
            <a
              className="text-teal-700 hover:underline"
              href={source.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {source.sourceUrl}
            </a>
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-muted">{source.details}</p>
    </article>
  );
}

export function Dashboard({ data }: DashboardProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.3fr,0.9fr] lg:p-8">
          <div>
            <span className="eyebrow">Politix MVP</span>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl">
              Transparencia politica com um diretorio unificado de Camara e Senado.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              A homepage agora conecta busca parlamentar, ranking de gastos, alertas simples e
              analise de fornecedores usando fontes oficiais e cache server-side.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="primary-button" href="/insights">
                Abrir rankings e alertas
              </Link>
              <Link className="secondary-button" href="/fornecedores">
                Explorar fornecedores
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                Search-first
              </span>
              <span className="soft-badge bg-[var(--warning-soft)] text-[var(--warning)]">
                APIs oficiais
              </span>
              <span className="soft-badge bg-slate-100 text-slate-700">App Router</span>
              <span className="soft-badge bg-slate-100 text-slate-700">
                Atualizado em {formatDateTime(data.updatedAt)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard label="Parlamentares" value={String(data.summary.total)} tone="accent" />
            <SummaryCard label="Deputados" value={String(data.summary.camara)} tone="slate" />
            <SummaryCard label="Senadores" value={String(data.summary.senado)} tone="warning" />
            <SummaryCard label="UFs cobertas" value={String(data.summary.states)} tone="slate" />
          </div>
        </div>
      </section>

      <section className="panel p-6 lg:p-7">
        <div className="flex flex-col gap-2">
          <span className="eyebrow w-fit">Busca e filtros</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Consulta de politicos</h2>
          <p className="text-sm text-muted">
            Municipio aparece quando a origem disponibiliza o dado. Agora voce tambem consegue
            recortar por partido e casa legislativa.
          </p>
        </div>

        <form
          className="mt-6 grid gap-4 lg:grid-cols-[2fr,1fr,1fr,1fr,1fr,auto,auto]"
          method="GET"
        >
          <input
            className="field"
            defaultValue={data.filters.query}
            name="q"
            placeholder="Buscar por nome, partido ou UF"
            type="search"
          />

          <select className="field" defaultValue={data.filters.state} name="uf">
            <option value="">Todos os estados</option>
            {data.availableStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>

          <select className="field" defaultValue={data.filters.city} name="city">
            <option value="">Municipio (quando disponivel)</option>
            {data.availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select className="field" defaultValue={data.filters.party} name="party">
            <option value="">Todos os partidos</option>
            {data.availableParties.map((party) => (
              <option key={party} value={party}>
                {party}
              </option>
            ))}
          </select>

          <select className="field" defaultValue={data.filters.house} name="house">
            <option value="">Camara e Senado</option>
            <option value="camara">Camara</option>
            <option value="senado">Senado</option>
          </select>

          <button className="primary-button" type="submit">
            Aplicar filtros
          </button>

          <Link className="secondary-button" href="/">
            Limpar
          </Link>
        </form>
      </section>

      <section className="panel p-6 lg:p-7">
        <div className="border-b border-slate-200/80 pb-5">
          <span className="eyebrow">Confianca da fonte</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Ultima atualizacao e origem</h2>
          <p className="mt-2 text-sm text-muted">
            O diretorio consolidado fica cacheado no servidor e expomos o status das fontes
            oficiais para deixar o dado auditavel desde a home.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.sourceStatus.map((source) => (
            <SourceStatusCard key={source.id} source={source} />
          ))}
        </div>
      </section>

      <section className="panel p-6 lg:p-7">
        <ResultsHeader filters={data.filters} matchingCount={data.matchingCount} />

        {data.items.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((politician) => (
              <PoliticianCard key={politician.id} politician={politician} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-10 text-center">
            <h3 className="text-xl font-bold text-slate-950">Nenhum parlamentar encontrado</h3>
            <p className="mt-2 text-sm text-muted">
              Tente reduzir a busca textual ou limpar um dos filtros avancados.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
