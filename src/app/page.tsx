import { MunicipalTransparencyHome } from "@/components/municipal-transparency-home";
import { getMgMunicipalities } from "@/lib/ibge";

export default async function HomePage() {
  const cities = await getMgMunicipalities();

  return <MunicipalTransparencyHome cities={cities} />;
}
