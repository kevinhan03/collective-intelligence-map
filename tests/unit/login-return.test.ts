import { expect, it } from "vitest";
import { loginHref, safeReturnPath } from "@/domain/login-return";

it("keeps an internal place deep link through login", () => {
  expect(safeReturnPath("/maps/korea-vintage?place=123")).toBe(
    "/maps/korea-vintage?place=123",
  );
  expect(loginHref("/maps/korea-vintage?place=123")).toBe(
    "/login?next=%2Fmaps%2Fkorea-vintage%3Fplace%3D123",
  );
});

it.each([
  "https://example.com",
  "//example.com",
  "/\\example.com",
  "javascript:alert(1)",
  "/login",
  "/auth/callback",
])("rejects unsafe or looping return path %s", (value) => {
  expect(safeReturnPath(value)).toBe("/");
});
