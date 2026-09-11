import { expect, it } from "vitest";
import { formatLocation } from "@/domain/location";
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
