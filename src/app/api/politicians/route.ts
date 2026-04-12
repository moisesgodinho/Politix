import { NextRequest, NextResponse } from "next/server";

import { searchPoliticians } from "@/lib/politics";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const data = await searchPoliticians({
    query: searchParams.get("q") ?? "",
    state: searchParams.get("uf") ?? "",
    city: searchParams.get("city") ?? ""
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=900, stale-while-revalidate=43200"
    }
  });
}
