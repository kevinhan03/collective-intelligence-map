import type { Candidate, ThemeMap } from "@/domain/types";
export type SearchContext = {
  map: ThemeMap;
  session: string;
  /** Hints which script/language to match names in (Google only). */
  languageCode?: string;
};
export interface PlaceProvider {
  search(query: string, context: SearchContext): Promise<Candidate[]>;
  details(candidate: Candidate, context: SearchContext): Promise<Candidate>;
}
export async function providerFetch(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json();
}
