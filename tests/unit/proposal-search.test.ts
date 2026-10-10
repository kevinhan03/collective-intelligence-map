import { describe, expect, it } from "vitest";
import { demoMap } from "@/server/demo";
import {
  normalizeProposalQuery,
  withinSearchScope,
} from "@/domain/search-scope";
import { providerName } from "@/server/places/provider-router";
import {
  ProposalSearchCache,
  type ProposalSearchResult,
} from "@/domain/proposal-search-cache";
const result: ProposalSearchResult = { internal: [], candidates: [] };
describe("proposal search scope", () => {
  it("normalizes width, case and whitespace", () => {
    expect(normalizeProposalQuery("  ＶＩＮＴＡＧＥ　 Shop  ")).toBe(
      "vintage shop",
    );
  });
  it("restricts regions and countries, including dateline-crossing regions", () => {
    const map = {
      ...demoMap,
      country: "JP",
      bounds: { west: 170, east: -170, south: -10, north: 10 },
    };
    expect(
      withinSearchScope(map, { countryCode: "JP", lat: 0, lng: 179 }),
    ).toBe(true);
    expect(
      withinSearchScope(map, { countryCode: "JP", lat: 0, lng: -179 }),
    ).toBe(true);
    expect(withinSearchScope(map, { countryCode: "JP", lat: 0, lng: 0 })).toBe(
      false,
    );
    expect(
      withinSearchScope(
        { ...map, search_scope: "country" },
        { countryCode: "JP", lat: 0, lng: 0 },
      ),
    ).toBe(true);
    expect(
      withinSearchScope(
        { ...map, search_scope: "country" },
        { countryCode: "KR", lat: 0, lng: 0 },
      ),
    ).toBe(false);
    expect(
      withinSearchScope(
        { ...map, search_scope: "world", country: null },
        { countryCode: "FR", lat: 48, lng: 2 },
      ),
    ).toBe(true);
    expect(
      withinSearchScope({ ...map, search_scope: "world" }, { lat: 91, lng: 2 }),
    ).toBe(false);
    expect(providerName("KR", "world")).toBe("overture");
  });
});
describe("per-viewer memory cache", () => {
  it("expires after two minutes and evicts least recently used results", () => {
    const cache = new ProposalSearchCache();
    for (let i = 0; i < 30; i++) cache.set(String(i), result, 1000);
    expect(cache.get("0", 1001)).toEqual(result);
    cache.set("30", result, 1002);
    expect(cache.get("1", 1003)).toBeUndefined();
    expect(cache.get("0", 121000)).toBeUndefined();
    cache.clear();
    expect(cache.get("30", 1004)).toBeUndefined();
  });
  it("does not reuse expired or malformed candidate tokens or share between instances", () => {
    const cache = new ProposalSearchCache();
    const candidate = {
      provider: "overture" as const,
      externalId: "1",
      label: "예시",
      attribution: "Overture Maps",
    };
    cache.set(
      "bad",
      { ...result, candidates: [{ ...candidate, token: "bad" }] },
      1000,
    );
    expect(cache.get("bad", 1001)).toBeUndefined();
    cache.set(
      "valid",
      {
        ...result,
        candidates: [
          {
            ...candidate,
            token: `${btoa(JSON.stringify({ expires: 8000 }))}.signature`,
          },
        ],
      },
      1000,
    );
    expect(cache.get("valid", 2000)?.candidates).toHaveLength(1);
    expect(cache.get("valid", 3000)).toBeUndefined();
    expect(new ProposalSearchCache().get("valid", 2000)).toBeUndefined();
  });
});
