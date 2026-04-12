import { Dashboard } from "@/components/dashboard";
import { searchPoliticians } from "@/lib/politics";

type SearchParamValue = string | string[] | undefined;

type PageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

function getSearchValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function Home({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const houseValue = getSearchValue(resolvedSearchParams.house);

  const data = await searchPoliticians({
    query: getSearchValue(resolvedSearchParams.q),
    state: getSearchValue(resolvedSearchParams.uf),
    city: getSearchValue(resolvedSearchParams.city),
    party: getSearchValue(resolvedSearchParams.party),
    house: houseValue === "camara" || houseValue === "senado" ? houseValue : undefined
  });

  return <Dashboard data={data} />;
}
