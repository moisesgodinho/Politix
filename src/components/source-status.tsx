import type { SourceStatus } from "@/lib/ceap";

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

export function SourceStatusPanel({ sources }: { sources: SourceStatus[] }) {
  return (
    <section className="panel p-6 lg:p-7">
      <div className="border-b border-slate-200/80 pb-5">
        <span className="eyebrow">Confianca da fonte</span>
        <h2 className="mt-3 text-2xl font-bold text-slate-950">Ultima atualizacao e status</h2>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {sources.map((source) => (
          <article
            key={source.id}
            className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-950">{source.label}</h3>
              <span
                className={`soft-badge ${
                  source.status === "ok"
                    ? "bg-[var(--accent-soft)] text-[var(--accent-contrast)]"
                    : "bg-[var(--warning-soft)] text-[var(--warning)]"
                }`}
              >
                {source.status === "ok" ? "Operacional" : "Atenção"}
              </span>
            </div>

            <dl className="mt-5 grid gap-3 text-sm text-slate-700">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.16em] text-muted">App verificado em</dt>
                <dd className="mt-1 font-semibold">
                  <span suppressHydrationWarning>{formatDateTime(source.checkedAt)}</span>
                </dd>
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
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-[0.16em] text-muted">Cadencia</dt>
                <dd className="mt-1 font-semibold">{source.updateCadence ?? "Nao informado"}</dd>
              </div>
              {source.upstreamLastModified ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs uppercase tracking-[0.16em] text-muted">Last-Modified</dt>
                  <dd className="mt-1 font-semibold">
                    <span suppressHydrationWarning>
                      {formatDateTime(source.upstreamLastModified)}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-4 text-sm text-muted">{source.details}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
