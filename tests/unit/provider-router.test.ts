import { expect, it } from "vitest";
import { providerName } from "@/server/places/provider-router";
it("routes Korea to Kakao and international maps to Overture", () => {
  expect(providerName("KR")).toBe("kakao");
  expect(providerName("JP")).toBe("overture");
  expect(providerName("FR")).toBe("overture");
});
