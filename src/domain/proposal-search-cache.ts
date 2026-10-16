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
  /** External search was skipped because a usage limit was reached. */
  externalLimit?: ExternalSearchLimit;
};
export type ExternalSearchLimit =
  { kind: "user"; retryAfterMinutes: number | null } | { kind: "budget" };
/** Reads the hint attached by `private.reserve_provider` to a limit error. */
export function parseExternalSearchLimit(
  hint: string | null | undefined,
): ExternalSearchLimit | null {
  if (hint === "provider_budget") return { kind: "budget" };
  const match = /^retry_after_minutes=(\d+)$/.exec(hint ?? "");
  if (match) return { kind: "user", retryAfterMinutes: Number(match[1]) };
  return null;
}
/** User-facing explanation; internal results stay usable either way. */
export function externalSearchLimitMessage(limit: ExternalSearchLimit) {
  if (limit.kind === "budget")
    return "오늘은 외부 장소 검색을 더 할 수 없어요. 이미 등록된 장소에서 고르거나 직접 등록해 주세요.";
  const wait = limit.retryAfterMinutes
    ? `약 ${limit.retryAfterMinutes}분 뒤`
    : "잠시 후";
  return `외부 장소 검색을 잠시 쉬어 갈게요. ${wait} 다시 검색할 수 있어요. 그동안 이미 등록된 장소에서 고르거나 직접 등록할 수 있어요.`;
}
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
