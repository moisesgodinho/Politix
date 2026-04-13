"use client";

import { useState, useTransition } from "react";

import { CityCombobox } from "@/components/city-combobox";
import { ProcurementCard } from "@/components/procurement-card";
import { formatLongDateTime } from "@/lib/format";
import type {
  MunicipalityOption,
  ProcurementSearchResponse,
  ProcurementSummary
} from "@/lib/types";

type MunicipalTransparencyHomeProps = {
  cities: MunicipalityOption[];
};

export function MunicipalTransparencyHome({
  cities
}: MunicipalTransparencyHomeProps) {
  const [selectedCity, setSelectedCity] = useState<MunicipalityOption | null>(null);
  const [contracts, setContracts] = useState<ProcurementSummary[]>([]);
  const [searchMeta, setSearchMeta] = useState<Omit<
    ProcurementSearchResponse,
    "contracts"
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function searchContracts(city: MunicipalityOption) {
    const response = await fetch(`/api/contracts?cityCode=${city.code}`, {
      cache: "no-store"
    });

    const payload = (await response.json()) as ProcurementSearchResponse & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Falha ao consultar o PNCP.");
    }

    setContracts(payload.contracts);
    setSearchMeta({
      cityCode: payload.cityCode,
      fetchedAt: payload.fetchedAt,
      windowDays: payload.windowDays,
      partial: payload.partial,
      total: payload.total
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
      <section className="panel relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-r from-teal-500/10 via-transparent to-amber-400/10" />
        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-5">
            <span className="eyebrow">Transparencia municipal em tempo real</span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl leading-tight text-slate-950 sm:text-5xl">
                Licitacoes de Minas Gerais cruzadas com idade societaria do CNPJ vencedor.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                O portal consulta IBGE, PNCP e BrasilAPI sob demanda, sem banco proprio.
                Quando a empresa vencedora tiver menos de 1 ano na data da contratacao,
                o card recebe um alerta visual de risco.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4">
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Fonte oficial
                </span>
                <strong className="mt-2 block text-xl text-slate-950">IBGE + PNCP</strong>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Lista de municipios e licitacoes chegam direto das APIs publicas.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4">
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Alerta principal
                </span>
                <strong className="mt-2 block text-xl text-slate-950">&lt; 1 ano</strong>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O destaque aparece quando o CNPJ for recem-aberto na data usada como referencia.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4">
                <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Protecao de rate limit
                </span>
                <strong className="mt-2 block text-xl text-slate-950">Lazy loading</strong>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  A BrasilAPI so e acionada quando o usuario expande a licitacao.
                </p>
              </div>
            </div>
          </div>

          <div className="panel bg-white/88 p-5 sm:p-6">
            <div className="space-y-4">
              <div>
                <span className="eyebrow">Consulta ao vivo</span>
                <h2 className="mt-4 text-2xl text-slate-950">
                  Escolha uma cidade e busque as licitacoes mais recentes
                </h2>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();

                  if (!selectedCity) {
                    setError("Selecione um municipio de Minas Gerais para continuar.");
                    return;
                  }

                  setError(null);

                  startTransition(async () => {
                    try {
                      await searchContracts(selectedCity);
                    } catch (requestError) {
                      setContracts([]);
                      setSearchMeta(null);
                      setError(
                        requestError instanceof Error
                          ? requestError.message
                          : "Falha ao carregar os dados."
                      );
                    }
                  });
                }}
              >
                <CityCombobox
                  cities={cities}
                  onSelect={(city) => {
                    setSelectedCity(city);
                    setError(null);
                  }}
                  selectedCity={selectedCity}
                />

                <button className="primary-button w-full" disabled={isPending} type="submit">
                  {isPending ? "Buscando licitacoes..." : "Buscar licitacoes"}
                </button>
              </form>

              <div className="rounded-[24px] border border-teal-900/10 bg-teal-50/80 p-4 text-sm leading-6 text-teal-950">
                Os resultados sao buscados no servidor com `revalidate` curto para acelerar
                consultas repetidas sem depender de banco de dados.
              </div>

              {error ? (
                <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4 pb-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Resultado</span>
            <h2 className="mt-3 text-3xl text-slate-950">
              {selectedCity ? `Licitacoes em ${selectedCity.name}` : "Selecione um municipio"}
            </h2>
          </div>

          {searchMeta ? (
            <div className="rounded-[24px] border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
              Janela consultada: ultimos {searchMeta.windowDays} dias. Atualizado em{" "}
              {formatLongDateTime(searchMeta.fetchedAt)}.
            </div>
          ) : null}
        </div>

        {searchMeta?.partial ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Algumas modalidades do PNCP ficaram lentas ou indisponiveis. A lista abaixo pode
            estar parcial, mas continua utilizavel.
          </div>
        ) : null}

        {contracts.length > 0 ? (
          <div className="grid gap-5">
            {contracts.map((contract) => (
              <ProcurementCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <div className="panel px-6 py-10 text-center text-slate-600">
            {selectedCity && !isPending
              ? "Nenhuma licitacao recente foi encontrada na janela consultada para esse municipio."
              : "Depois da busca, os cards com valores, modalidade e analise do vencedor aparecem aqui."}
          </div>
        )}
      </section>
    </main>
  );
}
