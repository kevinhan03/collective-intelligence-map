import { describe, expect, it } from "vitest";
import { placeArea, placeCity } from "../../src/domain/place-location";

describe("mobile city filters", () => {
  it("groups district addresses under their city", () => {
    expect(placeArea("서울 마포구 동교로 12")).toBe("서울 · 마포구");
    expect(placeCity("서울 마포구 동교로 12")).toBe("서울");
    expect(placeCity("Yongsan District, Seoul, South Korea")).toBe("서울");
  });
  it("recognizes Jeju and Tokyo without inventing a city for unknown addresses", () => {
    expect(placeCity("Jeju-si, Jeju-do")).toBe("제주");
    expect(placeCity("東京都渋谷区神宮前")).toBe("도쿄");
    expect(placeCity("Unknown address")).toBe("기타 지역");
    expect(placeCity("")).toBe("기타 지역");
  });
});
