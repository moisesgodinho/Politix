import "server-only";

import type { MunicipalityOption } from "@/lib/types";

type IbgeCityResponse = {
  id: number;
  nome: string;
  "regiao-imediata": {
    nome: string;
    "regiao-intermediaria": {
      nome: string;
    };
  };
};

const MG_CITIES_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/MG/municipios?orderBy=nome";

export async function getMgMunicipalities(): Promise<MunicipalityOption[]> {
  const response = await fetch(MG_CITIES_URL, {
    next: {
      revalidate: 60 * 60 * 24 * 7
    },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a lista de municipios do IBGE.");
  }

  const cities = (await response.json()) as IbgeCityResponse[];

  return cities.map((city) => ({
    code: String(city.id),
    name: city.nome,
    immediateRegion: city["regiao-imediata"].nome,
    intermediateRegion: city["regiao-imediata"]["regiao-intermediaria"].nome,
    state: "MG"
  }));
}
