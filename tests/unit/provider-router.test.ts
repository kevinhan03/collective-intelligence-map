import { expect, it } from "vitest";
import { providerName } from "@/server/places/provider-router";

it("uses Google Places for Korean and international Theme Maps", () => {
  expect(providerName("KR")).toBe("google");
  expect(providerName("JP")).toBe("google");
  expect(providerName("FR")).toBe("google");
});
