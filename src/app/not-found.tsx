import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="soft-badge bg-[var(--warning-soft)] text-[var(--warning)]">
        Recurso nao encontrado
      </span>
      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-slate-950">Nao encontramos esta pagina.</h1>
        <p className="max-w-2xl text-base leading-7 text-muted">
          O link pode estar incompleto ou o registro ainda nao foi indexado no snapshot atual.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link className="primary-button" href="/">
          Voltar ao dashboard
        </Link>
        <Link className="secondary-button" href="/fornecedores">
          Explorar fornecedores
        </Link>
      </div>
    </main>
  );
}
