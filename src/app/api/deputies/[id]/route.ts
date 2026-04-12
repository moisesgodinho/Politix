import { NextRequest, NextResponse } from "next/server";

import { getDeputyDetails } from "@/lib/politics";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = await getDeputyDetails(id);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=900, stale-while-revalidate=43200"
      }
    });
  } catch {
    return NextResponse.json(
      {
        message: "Deputado nao encontrado."
      },
      {
        status: 404
      }
    );
  }
}
