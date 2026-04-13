import { NextResponse } from "next/server";

import { fetchRecentMunicipalProcurements } from "@/lib/pncp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cityCode = searchParams.get("cityCode")?.trim() ?? "";

  if (!/^\d{7}$/.test(cityCode)) {
    return NextResponse.json(
      { error: "Informe um codigo IBGE de 7 digitos." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchRecentMunicipalProcurements(cityCode);

    return NextResponse.json({
      cityCode,
      fetchedAt: new Date().toISOString(),
      windowDays: result.windowDays,
      partial: result.partial,
      total: result.contracts.length,
      contracts: result.contracts
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel consultar o PNCP agora.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
