import { NextResponse } from "next/server";

import {
  digitsOnly,
  fetchCompanyFromBrasilApi,
  formatCnpj,
  isValidCnpj,
  calculateCompanyAge,
  describeCompanyAge
} from "@/lib/company-age";
import { mapWithConcurrency } from "@/lib/concurrency";
import { fetchContractItems, fetchItemResults } from "@/lib/pncp";
import type { ProcurementItemInsight, WinnerCompanyAlert } from "@/lib/types";

type BrasilApiCompany = Awaited<ReturnType<typeof fetchCompanyFromBrasilApi>>;
type CompanyLookup = {
  company: BrasilApiCompany;
  error: string | null;
};

function getReferenceDate(
  awardDate: string | null,
  openingDate: string | null,
  publicationDate: string | null
) {
  if (awardDate) {
    return {
      value: awardDate,
      label: "Data do resultado"
    };
  }

  if (openingDate) {
    return {
      value: openingDate,
      label: "Abertura da proposta"
    };
  }

  return {
    value: publicationDate,
    label: "Publicacao no PNCP"
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organCnpj = searchParams.get("organCnpj")?.trim() ?? "";
  const year = Number(searchParams.get("year"));
  const sequence = Number(searchParams.get("sequence"));
  const controlNumber = searchParams.get("controlNumber")?.trim() ?? "";
  const openingDate = searchParams.get("openingDate");
  const publicationDate = searchParams.get("publicationDate");

  if (!isValidCnpj(organCnpj) || !Number.isInteger(year) || !Number.isInteger(sequence)) {
    return NextResponse.json(
      { error: "Parametros invalidos para consultar os detalhes da licitacao." },
      { status: 400 }
    );
  }

  try {
    const items = await fetchContractItems(digitsOnly(organCnpj), year, sequence);

    const itemSnapshots = await mapWithConcurrency(
      items,
      4,
      async (item): Promise<{
        item: (typeof items)[number];
        winnerResult: Awaited<ReturnType<typeof fetchItemResults>>[number] | null;
        fetchError: string | null;
      }> => {
        if (!item.temResultado) {
          return {
            item,
            winnerResult: null,
            fetchError: null
          };
        }

        try {
          const results = await fetchItemResults(
            digitsOnly(organCnpj),
            year,
            sequence,
            item.numeroItem
          );

          return {
            item,
            winnerResult: results[0] ?? null,
            fetchError: null
          };
        } catch (error) {
          return {
            item,
            winnerResult: null,
            fetchError:
              error instanceof Error
                ? error.message
                : "Falha ao consultar o resultado do item."
          };
        }
      }
    );

    const winnerResults = itemSnapshots.flatMap((snapshot) =>
      snapshot.winnerResult ? [snapshot.winnerResult] : []
    );

    const uniqueCnpjs = Array.from(
      new Set(
        winnerResults
          .filter(
            (result) => result.tipoPessoa === "PJ" && isValidCnpj(result.niFornecedor)
          )
          .map((result) => digitsOnly(result.niFornecedor))
      )
    );

    const companyEntries = await mapWithConcurrency<string, readonly [string, CompanyLookup]>(
      uniqueCnpjs,
      2,
      async (cnpj) => {
        try {
          const company = await fetchCompanyFromBrasilApi(cnpj);
          return [cnpj, { company, error: null }] as const;
        } catch (error) {
          return [
            cnpj,
            {
              company: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Falha ao consultar a BrasilAPI."
            }
          ] as const;
        }
      }
    );

    const companyMap = new Map<string, CompanyLookup>(companyEntries);

    const insights: ProcurementItemInsight[] = itemSnapshots.map((snapshot) => {
      const result = snapshot.winnerResult;
      const reference = getReferenceDate(
        result?.dataResultado ?? null,
        openingDate,
        publicationDate
      );

      let supplier: WinnerCompanyAlert | null = null;
      let analysisError = snapshot.fetchError;

      if (result?.tipoPessoa === "PJ" && isValidCnpj(result.niFornecedor)) {
        const lookup = companyMap.get(digitsOnly(result.niFornecedor));

        if (lookup?.error) {
          analysisError = lookup.error;
        } else if (lookup?.company === null) {
          analysisError = "CNPJ nao encontrado na BrasilAPI.";
        } else if (lookup?.company) {
          const age = calculateCompanyAge(
            lookup.company.data_inicio_atividade ?? null,
            reference.value
          );

          supplier = {
            cnpj: formatCnpj(result.niFornecedor),
            normalizedCnpj: digitsOnly(result.niFornecedor),
            legalName: lookup.company.razao_social,
            openedAt: lookup.company.data_inicio_atividade ?? null,
            referenceDate: reference.value,
            referenceLabel: reference.label,
            ageInDays: age.ageInDays,
            ageLabel: describeCompanyAge(age.ageInDays),
            isRecentlyOpened: age.isRecentlyOpened,
            registryStatus: lookup.company.descricao_situacao_cadastral ?? null
          };
        }
      }

      return {
        itemNumber: snapshot.item.numeroItem,
        description: snapshot.item.descricao,
        quantity: snapshot.item.quantidade ?? null,
        unit: snapshot.item.unidadeMedida ?? null,
        estimatedUnitValue: snapshot.item.valorUnitarioEstimado ?? null,
        totalValue: snapshot.item.valorTotal ?? null,
        judgmentCriterion: snapshot.item.criterioJulgamentoNome ?? null,
        winnerName: result?.nomeRazaoSocialFornecedor ?? null,
        winnerDocument: result?.niFornecedor
          ? isValidCnpj(result.niFornecedor)
            ? formatCnpj(result.niFornecedor)
            : result.niFornecedor
          : null,
        winnerType: result?.tipoPessoa ?? null,
        awardDate: result?.dataResultado ?? null,
        awardValue: result?.valorTotalHomologado ?? null,
        supplier,
        analysisError
      };
    });

    const alertCount = insights.filter((item) => item.supplier?.isRecentlyOpened).length;

    return NextResponse.json({
      controlNumber,
      analyzedAt: new Date().toISOString(),
      hasRecentCompanyAlert: alertCount > 0,
      alertCount,
      items: insights
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel consultar os detalhes da licitacao.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
