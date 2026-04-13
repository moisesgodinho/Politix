import Link from "next/link";
import { notFound } from "next/navigation";

import { DeputyExpenseCharts } from "@/components/deputy-expense-charts";
import { getDeputyDetails } from "@/lib/politics";

type DeputyPageProps = {
  params: Promise<{
    id: string;
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

export default async function DeputyDetailsPage({ params }: DeputyPageProps) {
  const { id } = await params;

  try {
    const deputy = await getDeputyDetails(id);

    return (
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="panel overflow-hidden">
          <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
            <div>
              <Link className="eyebrow" href="/">
                Voltar para o dashboard
              </Link>

              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
                {deputy.photoUrl ? (
                  <img
                    alt={`Foto de ${deputy.name}`}
                    className="h-28 w-28 rounded-[28px] border border-slate-200/80 object-cover"
                    src={deputy.photoUrl}
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-slate-100 text-3xl font-bold text-slate-500">
                    {deputy.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="soft-badge bg-[var(--accent-soft)] text-[var(--accent-contrast)]">
                      Deputado Federal
                    </span>
                    <Link
                      className="soft-badge bg-slate-100 text-slate-700 hover:bg-slate-200"
                      href={`/partidos/${encodeURIComponent(deputy.party)}`}
                    >
                      {deputy.party} / {deputy.state}
                    </Link>
                  </div>

                  <h1 className="mt-4 text-4xl font-bold text-slate-950">{deputy.name}</h1>
                  <p className="mt-2 text-base text-muted">
                    Nome civil: {deputy.civilName ?? deputy.fullName ?? "Nao informado"}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Status atual: {deputy.status ?? "Em exercicio"} • Legislatura{" "}
                    {deputy.legislature ?? "atual"}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      className="secondary-button"
                      href={`/partidos/${encodeURIComponent(deputy.party)}`}
                    >
                      Ver partido
                    </Link>
                    {deputy.profileUrl ? (
                      <a
                        className="primary-button"
                        href={deputy.profileUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Perfil oficial da Camara
                      </a>
                    ) : null}
                    {deputy.website ? (
                      <a
                        className="secondary-button"
                        href={deputy.website}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Site institucional
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
              <InfoCard label="Despesas carregadas" value={String(deputy.expenseSummary.count)} />
              <InfoCard
                label="Valor bruto"
                value={formatCurrency(deputy.expenseSummary.totalAmount)}
              />
              <InfoCard
                label="Fornecedores"
                value={String(deputy.expenseSummary.uniqueSuppliers)}
              />
              <InfoCard
                label="Ticket medio"
                value={formatCurrency(deputy.expenseSummary.averageAmount)}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="panel p-6 lg:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-5">
              <div>
                <span className="eyebrow">Identificacao</span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">Dados pessoais</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoCard label="Email" value={deputy.email} />
              <InfoCard label="CPF" value={deputy.cpf} />
              <InfoCard label="Genero" value={deputy.gender} />
              <InfoCard label="Nascimento" value={formatDate(deputy.birthDate)} />
              <InfoCard label="Cidade natal" value={deputy.birthCity} />
              <InfoCard label="UF natal" value={deputy.birthState} />
              <InfoCard label="Escolaridade" value={deputy.education} />
              <InfoCard
                label="Redes sociais"
                value={deputy.socialMedia.length > 0 ? `${deputy.socialMedia.length} perfis` : undefined}
              />
            </div>

            {deputy.socialMedia.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {deputy.socialMedia.map((socialLink) => (
                  <a
                    key={socialLink}
                    className="soft-badge bg-slate-100 text-slate-700"
                    href={socialLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {socialLink}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel p-6 lg:p-7">
            <div className="border-b border-slate-200/80 pb-5">
              <span className="eyebrow">Gabinete</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-950">Contato parlamentar</h2>
            </div>

            <div className="mt-6 grid gap-4">
              <InfoCard label="Gabinete" value={deputy.cabinet?.name} />
              <InfoCard label="Predio" value={deputy.cabinet?.building} />
              <InfoCard label="Sala" value={deputy.cabinet?.room} />
              <InfoCard label="Andar" value={deputy.cabinet?.floor} />
              <InfoCard label="Telefone" value={deputy.cabinet?.phone} />
              <InfoCard label="Email do gabinete" value={deputy.cabinet?.email} />
            </div>
          </div>
        </section>

        <DeputyExpenseCharts expenses={deputy.expenses} />
      </main>
    );
  } catch {
    notFound();
  }
}
