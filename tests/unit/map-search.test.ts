import { describe, it, expect } from "vitest";
import {
  compactSearch,
  normalizeSearch,
  matchesSearch,
  localMapSearch,
  mapSearchInput,
} from "@/domain/map-search";
import type { MapPlace } from "@/domain/types";
const place = (name: string, extra: Partial<MapPlace> = {}): MapPlace => ({
  id: name,
  place_id: name,
  map_id: "map",
  name,
  address: "서울 용산구",
  category: "thrift_store",
  rationale: "천천히 구경하기 좋은 가게",
  lat: 37,
  lng: 127,
  status: "approved",
  added_by: null,
  handle: "",
  positive: 0,
  negative: 0,
  saved_count: 0,
  created_at: "2026-01-01",
  last_verified_at: null,
  ...extra,
});
describe("map search", () => {
  it("normalizes width, case, unicode spaces and treats wildcard characters literally", () => {
    expect(normalizeSearch("　ＡＲＣＨＩＶＥ\t Room　")).toBe("archive room");
    expect(compactSearch("빈티지 숍")).toBe("빈티지숍");
    expect(matchesSearch(place("Archive Room"), "％")).toBe(false);
  });
  it("matches all terms across fields and includes visible category/area labels", () => {
    expect(matchesSearch(place("Archive Room"), "용산 빈티지숍")).toBe(true);
    expect(matchesSearch(place("Archive Room"), "용산 부산")).toBe(false);
    expect(matchesSearch(place("Archive Room"), "ＡＲＣＨＩＶＥＲＯＯＭ")).toBe(
      true,
    );
  });
  it("puts name matches ahead of recommendation scores and pages after sorting", () => {
    const places = [
      place("other", { rationale: "Archive 추천", positive: 100 }),
      place("Archive Room"),
      place("Archive"),
    ];
    expect(
      localMapSearch(places, mapSearchInput.parse({ q: "archive" })).items.map(
        (p) => p.name,
      ),
    ).toEqual(["Archive", "Archive Room", "other"]);
    expect(
      localMapSearch(
        places,
        mapSearchInput.parse({ q: "archive", sort: "popular" }),
      ).items[0].name,
    ).toBe("other");
    expect(
      localMapSearch(
        Array.from({ length: 25 }, (_, i) => place(`place ${i}`)),
        mapSearchInput.parse({ q: "place", offset: 20 }),
      ).items,
    ).toHaveLength(5);
  });
  it("does not pretend a station filter works without server station data", () => {
    expect(
      localMapSearch(
        [place("Archive")],
        mapSearchInput.parse({ stationId: "station" }),
      ).items,
    ).toEqual([]);
    expect(mapSearchInput.safeParse({ sort: "distance" }).success).toBe(false);
    expect(mapSearchInput.safeParse({ lat: 35 }).success).toBe(false);
  });
});
