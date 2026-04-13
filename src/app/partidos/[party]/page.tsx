import Link from "next/link";
import { notFound } from "next/navigation";

import { SourceStatusPanel } from "@/components/source-status";
import { getPartySnapshot } from "@/lib/ceap";
import { searchPoliticians, type Politician } from "@/lib/politics";

type PartyDetailsPageProps = {
  params: Promise<{
    party: string;
  }>;
};

function normalizePartyParam(value: string) {
  return decodeURIComponent(value).trim().toUpperCase();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDateTime(value: string) {
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

function getDetailsHref(politician: Politician) {
  return politician.source === "camara"
    ? `/deputados/${politician.externalId}`
    : `/senadores/${politician.externalId}`;
}

function sortPoliticians(items: Politician[]) {
  return [...items].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "camara" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });
}

function SummaryCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="panel p-5">
      <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
        {label}
      </span>
      <p className="mt-5 text-3xl font-bold text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-sm text-muted">{helper}</p> : null}
    </div>
  );
}

function PoliticianCompactCard({ politician }: { politician: Politician }) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5">
      <div className="flex items-start gap-4">
        {politician.photoUrl ? (
          <img
            alt={`Foto de ${politician.name}`}
            className="h-14 w-14 rounded-2xl border border-slate-200/70 object-cover"
            src={politician.photoUrl}
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-500">
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
            <span className="soft-badge bg-slate-100 text-slate-700">{politician.state}</span>
          </div>

          <h3 className="mt-3 text-lg font-bold text-slate-950">{politician.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {politician.house} • {politician.status ?? "Em exercicio"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.16em] text-muted">
          ID {politician.externalId}
        </span>
        <Link
          className="text-sm font-semibold text-teal-700 transition hover:text-teal-800"
          href={getDetailsHref(politician)}
        >
          Abrir perfil
        </Link>
      </div>
    </article>
  );
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

export default async function PartyDetailsPage({ params }: PartyDetailsPageProps) {
  const { party } = await params;
  const normalizedParty = normalizePartyParam(party);

  if (!normalizedParty) {
    notFound();
  }

  const [directory, snapshot] = await Promise.all([
    searchPoliticians({ party: normalizedParty }),
    getPartySnapshot(normalizedParty)
  ]);

  const members = sortPoliticians(directory.items);
  const deputies = members.filter((politician) => politician.source === "camara");
  const senators = members.filter((politician) => politician.source === "senado");

  if (members.length === 0 && snapshot.totals.expenseCount === 0) {
    notFound();
  }

  const partyLabel = members[0]?.party ?? snapshot.party;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
          <div>
            <Link className="eyebrow" href="/insights">
              Voltar para insights
            </Link>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                Partido
              </span>
              <span className="soft-badge bg-slate-100 text-slate-700">{partyLabel}</span>
            </div>

            <h1 className="mt-4 text-4xl font-bold text-slate-950 sm:text-5xl">
              Raio-X do partido {partyLabel}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Esta pagina cruza composicao atual de Camara e Senado com a CEAP da Camara para
              destacar deputados do partido, fornecedores recorrentes, distribuicao por UF e sinais
              simples de risco.
            </p>
            <p className="mt-3 text-sm text-muted">
              Ultima atualizacao consolidada:{" "}
              <span suppressHydrationWarning>{formatDateTime(snapshot.updatedAt)}</span>. Os dados
              de CEAP cobrem apenas deputados federais; senadores aparecem na composicao do partido.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="primary-button" href={`/partidos/${encodeURIComponent(partyLabel)}`}>
                Recarregar partido
              </Link>
              <Link className="secondary-button" href="/">
                Voltar ao dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard
              label="Parlamentares"
              value={String(members.length)}
              helper="Deputados e senadores monitorados"
            />
            <SummaryCard label="Deputados" value={String(deputies.length)} />
            <SummaryCard label="Senadores" value={String(senators.length)} />
            <SummaryCard
              label="Gasto CEAP"
              value={formatCurrency(snapshot.totals.totalAmount)}
              helper={`${snapshot.totals.expenseCount} despesas no arquivo anual`}
            />
            <SummaryCard
              label="Fornecedores"
              value={String(snapshot.totals.supplierCount)}
              helper="No recorte CEAP do partido"
            />
            <SummaryCard
              label="Alertas"
              value={String(snapshot.alerts.length)}
              helper="Sinais simples de concentracao ou salto"
            />
          </div>
        </div>
      </section>

      <SourceStatusPanel sources={snapshot.sourceStatus} />

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Composicao</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Deputados do partido</h2>
          </div>

          {deputies.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {deputies.map((politician) => (
                <PoliticianCompactCard
                  key={`${politician.source}-${politician.externalId}`}
                  politician={politician}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="Sem deputados no diretorio atual"
                description="O diretorio oficial consolidado nao retornou deputados ativos para esta sigla."
              />
            </div>
          )}
        </section>

        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">Composicao</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Senadores do partido</h2>
          </div>

          {senators.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {senators.map((politician) => (
                <PoliticianCompactCard
                  key={`${politician.source}-${politician.externalId}`}
                  politician={politician}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="Sem senadores no diretorio atual"
                description="No recorte atual do Senado nao houve parlamentares ativos para esta sigla."
              />
            </div>
          )}
        </section>
      </section>

      {snapshot.totals.expenseCount > 0 ? (
        <>
          <section className="grid gap-6 xl:grid-cols-2">
            <section className="panel p-6 lg:p-7">
              <div className="border-b border-slate-200/80 pb-5">
                <span className="eyebrow">CEAP</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">
                  Deputados com maior gasto
                </h2>
              </div>

              <div className="mt-6 space-y-4">
                {snapshot.deputyRanking.slice(0, 12).map((deputy, index) => (
                  <article
                    key={`${deputy.deputyId ?? deputy.deputyName}-${index}`}
                    className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                          #{index + 1}
                        </p>
                        <h3 className="mt-2 text-lg font-bold text-slate-950">
                          {deputy.deputyName}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {deputy.state ?? "Sem UF"} • {deputy.uniqueSuppliers} fornecedores •{" "}
                          {deputy.expenseCount} despesas
                        </p>
                      </div>
                      <p className="text-lg font-bold text-slate-950">
                        {formatCurrency(deputy.totalAmount)}
                      </p>
                    </div>

                    {deputy.detailsHref ? (
                      <Link
                        className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:underline"
                        href={deputy.detailsHref}
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
                <span className="eyebrow">Fornecedores</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">
                  Fornecedores mais recorrentes
                </h2>
              </div>

              <div className="mt-6 space-y-4">
                {snapshot.supplierRanking.slice(0, 12).map((supplier, index) => (
                  <article
                    key={`${supplier.supplierId}-${index}`}
                    className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                          #{index + 1}
                        </p>
                        <h3 className="mt-2 text-lg font-bold text-slate-950">
                          {supplier.supplierName}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {supplier.supplierDocument ?? "Documento nao identificado"} •{" "}
                          {supplier.deputyCount} deputados
                        </p>
                      </div>
                      <p className="text-lg font-bold text-slate-950">
                        {formatCurrency(supplier.totalAmount)}
                      </p>
                    </div>

                    <Link
                      className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:underline"
                      href={supplier.href}
                    >
                      Abrir fornecedor
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <section className="panel p-6 lg:p-7">
              <div className="border-b border-slate-200/80 pb-5">
                <span className="eyebrow">UF</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">Gasto por estado</h2>
              </div>

              <div className="mt-6 space-y-4">
                {snapshot.stateRanking.map((item) => (
                  <div key={item.label} className="rounded-[24px] bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-950">{item.label}</span>
                      <span className="font-bold text-slate-950">
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {item.deputyCount} deputados no recorte
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel p-6 lg:p-7">
              <div className="border-b border-slate-200/80 pb-5">
                <span className="eyebrow">Categorias</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">Onde o partido gasta</h2>
              </div>

              <div className="mt-6 space-y-4">
                {snapshot.categoryBreakdown.map((item) => (
                  <div key={item.label} className="rounded-[24px] bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-950">{item.label}</span>
                      <span className="font-bold text-slate-950">
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {item.expenseCount} despesas • {item.supplierCount} fornecedores
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel p-6 lg:p-7">
              <div className="border-b border-slate-200/80 pb-5">
                <span className="eyebrow">Tempo</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">Evolucao mensal</h2>
              </div>

              <div className="mt-6 space-y-4">
                {snapshot.monthlySpending.map((item) => (
                  <div key={item.monthKey} className="rounded-[24px] bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-950">{item.label}</span>
                      <span className="font-bold text-slate-950">
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {item.expenseCount} despesas • {item.deputyCount} deputados
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="panel p-6 lg:p-7">
            <div className="border-b border-slate-200/80 pb-5">
              <span className="eyebrow">Alertas simples</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950">
                Padrões que merecem revisão
              </h2>
            </div>

            {snapshot.alerts.length > 0 ? (
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {snapshot.alerts.map((alert) => (
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
                        {alert.severity === "high" ? "Alta" : "Media"}
                      </span>
                      <span className="text-xs uppercase tracking-[0.16em] text-muted">
                        {alert.type === "spending_spike" ? "Salto de gasto" : "Concentracao"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-slate-950">{alert.title}</h3>
                    <p className="mt-2 text-sm text-muted">{alert.description}</p>
                    {alert.href ? (
                      <Link
                        className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:underline"
                        href={alert.href}
                      >
                        Investigar
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState
                  title="Sem alertas no recorte"
                  description="As regras simples nao encontraram concentracao relevante ou salto recente de gasto para este partido."
                />
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="panel p-6 lg:p-7">
          <div className="border-b border-slate-200/80 pb-5">
            <span className="eyebrow">CEAP</span>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              Sem despesas da CEAP para este recorte
            </h2>
          </div>

          <div className="mt-6">
            <EmptyState
              title="Nenhuma despesa localizada"
              description="A composicao do partido foi carregada, mas o arquivo anual da CEAP nao retornou despesas para esta sigla no recorte atual."
            />
          </div>
        </section>
      )}
    </main>
  );
}
