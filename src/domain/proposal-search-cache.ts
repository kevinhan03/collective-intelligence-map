import type { Candidate } from "./types";
export type InternalProposalPlace = {
  id: string;
  name: string;
  address: string;
  category: string;
  locality: string;
  lat: number;
  lng: number;
  currentMapPlaceId?: string | null;
  currentMapStatus?: string | null;
};
export type ProposalSearchResult = {
  internal: InternalProposalPlace[];
  candidates: Candidate[];
  session?: string;
  translationAvailable?: boolean;
  coverage?: "partial";
};
/** Per-mounted-form memory only; never persisted or shared between viewers. */
export class ProposalSearchCache {
  private entries = new Map<
    string,
    { result: ProposalSearchResult; expires: number }
  >();
  clear() {
    this.entries.clear();
  }
  get(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry || entry.expires <= now) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.result;
  }
  set(key: string, result: ProposalSearchResult, now = Date.now()) {
    let expires = now + 120_000;
    for (const candidate of result.candidates) {
      try {
        const encoded = candidate.token?.split(".")[0];
        if (!encoded) return;
        const claims = JSON.parse(
          atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
        ) as { expires?: number };
        if (
          typeof claims.expires !== "number" ||
          !Number.isFinite(claims.expires)
        )
          return;
        expires = Math.min(expires, claims.expires - 5_000);
      } catch {
        return;
      }
    }
    if (expires <= now) return;
    this.entries.delete(key);
    this.entries.set(key, { result, expires });
    while (this.entries.size > 30)
      this.entries.delete(this.entries.keys().next().value!);
  }
}
