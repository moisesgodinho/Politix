export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
      <div className="panel w-full max-w-2xl px-8 py-12 text-center">
        <span className="eyebrow">404</span>
        <h1 className="mt-4 text-4xl text-slate-950">Pagina nao encontrada</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          O recurso solicitado nao existe ou ainda nao foi publicado neste MVP.
        </p>
      </div>
    </main>
  );
}
