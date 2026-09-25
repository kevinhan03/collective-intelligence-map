import { expect, it } from "vitest";
import { formatLocation } from "@/domain/location";
import { placeArea } from "@/domain/place-location";
it("formats city and country when they differ", () => {
  expect(formatLocation({ city: "Tokyo", country: "JP" })).toBe(
    "TOKYO, JAPAN",
  );
});
it("collapses redundant city/country into a single name", () => {
  expect(formatLocation({ city: "Korea", country: "KR" })).toBe("KOREA");
});
it("falls back to the raw country code when unknown", () => {
  expect(formatLocation({ city: "Paris", country: "FR" })).toBe(
    "PARIS, FR",
  );
});
it("finds Korean search terms in English and Korean place addresses", () => {
  expect(placeArea("38 Sinheung-ro 20-gil, Yongsan-gu, Seoul, South Korea")).toBe("서울");
  expect(placeArea("서울 마포구 양화로 10")).toBe("서울 · 마포구");
  expect(placeArea("6-chōme-9-5 Ginza, Chuo City, Tokyo, Japan")).toBe("도쿄");
});
