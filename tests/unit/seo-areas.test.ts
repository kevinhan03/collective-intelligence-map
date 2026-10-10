import { describe, expect, it } from "vitest";
import { addressRegion, areaPath, seoAreas } from "@/domain/seo-areas";

const places = (address: string, count: number, prefix = address) =>
  Array.from({ length: count }, (_, i) => ({
    place_id: `${prefix}-${i}`,
    address,
  }));

describe("address-backed theme areas", () => {
  it("normalizes explicit Korean and English district names without guessing", () => {
    expect(addressRegion("서울특별시 용산구 녹사평대로32길 53")).toEqual({
      city: "서울",
      district: "용산구",
    });
    expect(addressRegion("서울 중구 필동2가 97-1")).toEqual({
      city: "서울",
      district: "중구",
    });
    expect(
      addressRegion("38 Sinheung-ro, Yongsan District, Seoul, South Korea"),
    ).toEqual({ city: "서울", district: "용산구" });
    expect(addressRegion("Seoul, Mapo-gu, South Korea")).toEqual({
      city: "서울",
      district: "마포구",
    });
    expect(addressRegion("Jungnang District, Seoul")).toEqual({
      city: "서울",
      district: "중랑구",
    });
    expect(addressRegion("Yongsan District")).toBeNull();
    expect(addressRegion("서울 · 지역 미상")).toEqual({
      city: "서울",
      district: "",
    });
  });
  it("requires three distinct places and excludes empty or whole-map copies", () => {
    expect(seoAreas([])).toEqual([]);
    expect(seoAreas(places("서울 용산구 한남동", 5))).toEqual([]);
    const all = [
      ...places("서울 용산구 한남동", 3),
      ...places("서울 마포구 망원동", 2),
    ];
    expect(
      seoAreas([...all, all[0]]).map((a) => [a.key, a.placeIds.length]),
    ).toEqual([["서울-용산구", 3]]);
  });
  it("retains genuinely different city and district inventories", () => {
    const all = [
      ...places("서울 용산구 한남동", 3),
      ...places("서울 마포구 망원동", 3),
      ...places("부산 해운대구 우동", 3),
    ];
    expect(seoAreas(all).map((a) => a.key)).toEqual([
      "서울",
      "부산-해운대구",
      "서울-마포구",
      "서울-용산구",
    ]);
    expect(seoAreas(all).find((a) => a.key === "서울")?.placeIds).toHaveLength(
      6,
    );
  });
  it("merges English and Korean records and never takes a neighborhood as a district", () => {
    const all = [
      ...places("서울 용산구 한남동", 2),
      ...places("Seoul, Yongsan-gu", 1),
      ...places("도쿄 화면 확인용 주소", 2),
    ];
    expect(seoAreas(all).map((a) => a.key)).toEqual(["서울-용산구"]);
    expect(addressRegion("제주시 이도이동 1")).toEqual({
      city: "제주",
      district: "",
    });
  });
  it("has stable encoded regional and paginated URLs", () => {
    expect(areaPath("korea-vintage", "서울-용산구")).toBe(
      "/maps/korea-vintage/areas/%EC%84%9C%EC%9A%B8-%EC%9A%A9%EC%82%B0%EA%B5%AC",
    );
    expect(areaPath("a/b", "서울-용산구", 2)).toContain("/maps/a%2Fb/areas/");
    expect(areaPath("korea-vintage", "서울-용산구", 2)).toMatch(/\/page\/2$/);
  });
});
