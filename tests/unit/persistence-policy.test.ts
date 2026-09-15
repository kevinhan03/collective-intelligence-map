import { expect, it, vi } from "vitest";
import {
  mayPersistPlaceFields,
  mayPersistReference,
} from "@/server/places/policies";
it("reference permission alone never allows Kakao field persistence", () => {
  vi.stubEnv("KAKAO_REF_STORAGE_ALLOWED", "true");
  vi.stubEnv("KAKAO_PLACE_STORAGE_ALLOWED", "false");
  expect(mayPersistReference("kakao")).toBe(true);
  expect(mayPersistPlaceFields("kakao")).toBe(false);
  expect(mayPersistPlaceFields("overture")).toBe(true);
  expect(mayPersistPlaceFields("google")).toBe(false);
  vi.unstubAllEnvs();
});
