import { describe, expect, it } from "vitest";
import { canRegisterPlaces } from "@/domain/place-registration";

describe("place registration permissions", () => {
  it("allows public participation only on Korea-scoped maps", () => {
    for (const viewer of [
      null,
      { role: "member" as const },
      { role: "contributor" as const },
    ]) {
      expect(
        canRegisterPlaces({ country: "KR", search_scope: "region" }, viewer),
      ).toBe(true);
      expect(
        canRegisterPlaces({ country: "KR", search_scope: "country" }, viewer),
      ).toBe(true);
      expect(canRegisterPlaces({ country: "JP" }, viewer)).toBe(false);
      expect(
        canRegisterPlaces({ country: null, search_scope: "world" }, viewer),
      ).toBe(false);
      expect(
        canRegisterPlaces({ country: "KR", search_scope: "world" }, viewer),
      ).toBe(false);
    }
  });
  it("allows admins to curate any map", () => {
    expect(canRegisterPlaces({ country: "JP" }, { role: "admin" })).toBe(true);
    expect(
      canRegisterPlaces(
        { country: null, search_scope: "world" },
        { role: "admin" },
      ),
    ).toBe(true);
  });
});
