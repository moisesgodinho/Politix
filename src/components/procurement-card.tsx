"use client";

import { useState, useTransition } from "react";

import { formatCurrency, formatDate, formatLongDateTime } from "@/lib/format";
import type { ProcurementDetailsResponse, ProcurementSummary } from "@/lib/types";

type ProcurementCardProps = {
  contract: ProcurementSummary;
};

export function ProcurementCard({
  contract
}: ProcurementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [details, setDetails] = useState<ProcurementDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleDetails() {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (!nextExpanded || details || isPending) {
      return;
    }

    setError(null);

    const params = new URLSearchParams({
      controlNumber: contract.controlNumber,
      organCnpj: contract.organCnpj,
      year: String(contract.year),
      sequence: String(contract.sequence),
      publicationDate: contract.publicationDate
    });

    if (contract.openingDate) {
      params.set("openingDate", contract.openingDate);
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/contracts/details?${params.toString()}`, {
          cache: "no-store"
        });

        const payload = (await response.json()) as ProcurementDetailsResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Falha ao consultar o vencedor.");
        }

        setDetails(payload);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Falha ao consultar os detalhes."
        );
      }
    });
  }

  const hasAlert = details?.hasRecentCompanyAlert ?? false;

  return (
    <article
      className={`panel overflow-hidden border p-6 transition ${
        hasAlert ? "border-amber-300 bg-amber-50/60" : "border-white/60 bg-white/80"
      }`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="soft-badge bg-slate-100 text-slate-700">
              {contract.modalityName}
            </span>
            <span className="soft-badge bg-teal-100 text-teal-900">{contract.statusName}</span>
            {hasAlert ? (
              <span className="soft-badge bg-amber-100 text-amber-900">
                Empresa Recem-Aberta
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="max-w-4xl text-2xl leading-tight text-slate-950">
              {contract.object}
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              {contract.organName} - {contract.unitName}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          <strong className="block text-slate-950">{contract.controlNumber}</strong>
          <span className="block">Processo {contract.processNumber || "nao informado"}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Valor homologado" value={formatCurrency(contract.homologatedValue)} />
        <Metric label="Valor estimado" value={formatCurrency(contract.estimatedValue)} />
        <Metric label="Publicacao" value={formatDate(contract.publicationDate)} />
        <Metric label="Abertura" value={formatDate(contract.openingDate) || "Nao informada"} />
      </div>

      {details?.hasRecentCompanyAlert ? (
        <div className="mt-6 rounded-[24px] border border-amber-300 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
          Alerta encontrado em {details.alertCount} item(ns): pelo menos um vencedor tinha
          menos de 1 ano de atividade na data usada como referencia.
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="secondary-button" onClick={toggleDetails} type="button">
          {isExpanded
            ? "Ocultar analise do vencedor"
            : isPending
              ? "Consultando vencedor..."
              : "Analisar vencedor"}
        </button>

        {contract.sourceLink ? (
          <a
            className="secondary-button"
            href={contract.sourceLink}
            rel="noreferrer"
            target="_blank"
          >
            Abrir no sistema de origem
          </a>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isExpanded ? (
        <div className="mt-6 border-t border-slate-200 pt-6">
          {details ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span>Analise gerada em {formatLongDateTime(details.analyzedAt)}</span>
                <span>|</span>
                <span>Busca sob demanda para reduzir rate limit na BrasilAPI</span>
              </div>

              <div className="grid gap-4">
                {details.items.map((item) => (
                  <div
                    className="rounded-[24px] border border-slate-200 bg-white/80 p-5"
                    key={`${contract.id}-${item.itemNumber}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="soft-badge bg-slate-100 text-slate-700">
                            Item {item.itemNumber}
                          </span>
                          {item.supplier?.isRecentlyOpened ? (
                            <span className="soft-badge bg-amber-100 text-amber-900">
                              Empresa Recem-Aberta
                            </span>
                          ) : null}
                        </div>

                        <h4 className="text-lg text-slate-950">{item.description}</h4>
                        <p className="text-sm text-slate-600">
                          Criterio: {item.judgmentCriterion ?? "Nao informado"} | Quantidade{" "}
                          {item.quantity ?? "N/I"} {item.unit?.trim() || ""}
                        </p>
                      </div>

                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <strong className="block text-slate-950">
                          {formatCurrency(item.awardValue ?? item.totalValue)}
                        </strong>
                        <span className="block">
                          Resultado em {formatDate(item.awardDate) || "analise pendente"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                        <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Vencedor
                        </span>
                        <strong className="mt-2 block text-base text-slate-950">
                          {item.winnerName ?? "Sem vencedor homologado"}
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.winnerDocument ?? "Documento nao informado"}
                          {item.winnerType ? ` | ${item.winnerType}` : ""}
                        </p>
                      </div>

                      <div
                        className={`rounded-[20px] border p-4 text-sm leading-6 ${
                          item.supplier?.isRecentlyOpened
                            ? "border-amber-300 bg-amber-50 text-amber-950"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {item.supplier ? (
                          <>
                            <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-current/70">
                              Idade da empresa
                            </span>
                            <strong className="mt-2 block text-base text-current">
                              {item.supplier.ageLabel}
                            </strong>
                            <p className="mt-2">
                              Abertura em {formatDate(item.supplier.openedAt)} |{" "}
                              {item.supplier.referenceLabel} em{" "}
                              {formatDate(item.supplier.referenceDate)}
                            </p>
                            {item.supplier.registryStatus ? (
                              <p className="mt-1">
                                Situacao cadastral: {item.supplier.registryStatus}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p>
                            {item.analysisError ??
                              "Sem CNPJ vencedor elegivel para cruzamento com a BrasilAPI."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? null : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              Carregando itens e verificando o CNPJ vencedor em paralelo...
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function Metric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <strong className="mt-2 block text-lg text-slate-950">{value}</strong>
    </div>
  );
}
