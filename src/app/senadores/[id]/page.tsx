import Link from "next/link";
import { notFound } from "next/navigation";

import { getSenatorDetails } from "@/lib/politics";

type SenatorPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  return value;
}

function formatLegislaturePeriod(
  label: string,
  period?: {
    number?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  if (!period?.number && !period?.startDate && !period?.endDate) {
    return undefined;
  }

  return `${label}: ${period.number ?? "?"} (${formatDate(period.startDate)} a ${formatDate(
    period.endDate
  )})`;
}

function InfoCard({
  label,
  value
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-3 break-words text-lg font-semibold text-slate-950">
        {value || "Nao informado"}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5">
      <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
        {label}
      </span>
      <p className="mt-5 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default async function SenatorDetailsPage({ params }: SenatorPageProps) {
  const { id } = await params;

  try {
    const senator = await getSenatorDetails(id);
    const legislatureLines = [
      formatLegislaturePeriod("1a legislatura", senator.currentMandate?.firstLegislature),
      formatLegislaturePeriod("2a legislatura", senator.currentMandate?.secondLegislature)
    ].filter(Boolean);

    return (
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="panel overflow-hidden">
          <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
            <div>
              <Link className="eyebrow" href="/">
                Voltar para o dashboard
              </Link>

              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
                {senator.photoUrl ? (
                  <img
                    alt={`Foto de ${senator.name}`}
                    className="h-28 w-28 rounded-[28px] border border-slate-200/80 object-cover"
                    src={senator.photoUrl}
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-slate-100 text-3xl font-bold text-slate-500">
                    {senator.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                      Senador
                    </span>
                    <Link
                      className="soft-badge bg-slate-100 text-slate-700 hover:bg-slate-200"
                      href={`/partidos/${encodeURIComponent(senator.party)}`}
                    >
                      {senator.party} / {senator.state}
                    </Link>
                    {senator.currentMandate?.description ? (
                      <span className="soft-badge bg-slate-100 text-slate-700">
                        {senator.currentMandate.description}
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-4 text-4xl font-bold text-slate-950">{senator.name}</h1>
                  <p className="mt-2 text-base text-muted">
                    Nome completo: {senator.fullName ?? "Nao informado"}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Status atual: {senator.status ?? "Em exercicio"} - Legislaturas{" "}
                    {senator.legislature ?? "atuais"}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      className="secondary-button"
                      href={`/partidos/${encodeURIComponent(senator.party)}`}
                    >
                      Ver partido
                    </Link>
                    {senator.profileUrl ? (
                      <a
                        className="primary-button"
                        href={senator.profileUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Perfil oficial do Senado
                      </a>
                    ) : null}
                    {senator.email ? (
                      <a className="secondary-button" href={`mailto:${senator.email}`}>
                        Enviar email
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <MetricCard label="Telefones" value={String(senator.phones.length)} />
              <MetricCard label="Mandatos mapeados" value={String(senator.mandates.length)} />
              <MetricCard
                label="Servicos abertos"
                value={String(senator.openDataServices.length)}
              />
              <MetricCard label="Codigo publico" value={senator.publicCode ?? "-"} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="panel p-6 lg:p-7">
            <div className="border-b border-slate-200/80 pb-5">
              <span className="eyebrow">Identificacao</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950">Dados do senador</h2>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoCard label="Email parlamentar" value={senator.email} />
              <InfoCard label="Genero" value={senator.gender} />
              <InfoCard label="Nascimento" value={formatDate(senator.birthDate)} />
              <InfoCard label="Cidade natal" value={senator.birthCity} />
              <InfoCard label="UF natal" value={senator.birthState} />
              <InfoCard
                label="Bloco parlamentar"
                value={senator.block?.nickname ?? senator.block?.name}
              />
              <InfoCard
                label="Mesa diretora"
                value={senator.isBoardMember ? "Participa" : "Nao sinalizado"}
              />
              <InfoCard
                label="Lideranca"
                value={senator.isLeadershipMember ? "Participa" : "Nao sinalizado"}
              />
            </div>

            <div className="mt-4">
              <InfoCard label="Endereco parlamentar" value={senator.address} />
            </div>

            {senator.phones.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {senator.phones.map((phone) => (
                  <span
                    key={`${phone.number}-${phone.isFax ? "fax" : "voice"}`}
                    className="soft-badge bg-slate-100 text-slate-700"
                  >
                    {phone.isFax ? "Fax" : "Telefone"}: {formatPhone(phone.number)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel p-6 lg:p-7">
            <div className="border-b border-slate-200/80 pb-5">
              <span className="eyebrow">Mandato atual</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950">Resumo institucional</h2>
            </div>

            <div className="mt-6 grid gap-4">
              <InfoCard label="Participacao" value={senator.currentMandate?.description} />
              <InfoCard label="UF do mandato" value={senator.currentMandate?.state} />
              <InfoCard
                label="Exercicios registrados"
                value={
                  typeof senator.currentMandate?.exercisesCount === "number"
                    ? String(senator.currentMandate.exercisesCount)
                    : undefined
                }
              />
            </div>

            {legislatureLines.length > 0 ? (
              <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Periodos do mandato
                </p>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  {legislatureLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {senator.currentMandate?.parties.length ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Historico partidario do mandato atual
                </p>
                <div className="mt-3 grid gap-3">
                  {senator.currentMandate.parties.map((party) => (
                    <div
                      key={`${party.code ?? party.acronym ?? party.name}-${party.joinedAt ?? ""}`}
                      className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4"
                    >
                      <p className="font-semibold text-slate-950">
                        {party.acronym ?? party.name ?? "Partido nao informado"}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Filiacao: {formatDate(party.joinedAt)}
                        {party.leftAt ? ` - Desfiliacao: ${formatDate(party.leftAt)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="panel p-6 lg:p-7">
            <div className="border-b border-slate-200/80 pb-5">
              <span className="eyebrow">Mandatos</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950">Historico por mandato</h2>
            </div>

            {senator.mandates.length > 0 ? (
              <div className="mt-6 grid gap-4">
                {senator.mandates.map((mandate) => (
                  <article
                    key={mandate.code ?? `${mandate.state}-${mandate.description}`}
                    className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                        {mandate.description ?? "Mandato"}
                      </span>
                      {mandate.state ? (
                        <span className="soft-badge bg-slate-100 text-slate-700">
                          {mandate.state}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-slate-700">
                      {formatLegislaturePeriod("1a legislatura", mandate.firstLegislature) ? (
                        <p>{formatLegislaturePeriod("1a legislatura", mandate.firstLegislature)}</p>
                      ) : null}
                      {formatLegislaturePeriod("2a legislatura", mandate.secondLegislature) ? (
                        <p>{formatLegislaturePeriod("2a legislatura", mandate.secondLegislature)}</p>
                      ) : null}
                    </div>

                    {mandate.alternates.length > 0 ? (
                      <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                          Suplentes
                        </p>
                        <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                          {mandate.alternates.map((alternate) => (
                            <li key={`${alternate.code ?? alternate.name}-${alternate.role ?? ""}`}>
                              {alternate.role ?? "Suplente"}: {alternate.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
                <h3 className="text-xl font-bold text-slate-950">Sem mandatos detalhados</h3>
                <p className="mt-2 text-sm text-muted">
                  O endpoint oficial do Senado nao retornou historico detalhado para este senador.
                </p>
              </div>
            )}
          </div>

          <div className="panel p-6 lg:p-7">
            <div className="border-b border-slate-200/80 pb-5">
              <span className="eyebrow">Dados abertos</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950">Servicos relacionados</h2>
            </div>

            {senator.openDataServices.length > 0 ? (
              <div className="mt-6 grid gap-4">
                {senator.openDataServices.map((service) => (
                  <article
                    key={`${service.name}-${service.url}`}
                    className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
                  >
                    <h3 className="text-lg font-bold text-slate-950">{service.name}</h3>
                    <p className="mt-2 text-sm text-muted">
                      {service.description ?? "Servico oficial exposto pelo Senado em dados abertos."}
                    </p>
                    <a
                      className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:underline"
                      href={service.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir endpoint oficial
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
                <h3 className="text-xl font-bold text-slate-950">Sem servicos adicionais</h3>
                <p className="mt-2 text-sm text-muted">
                  O detalhe oficial nao publicou links adicionais de dados abertos para este perfil.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}
