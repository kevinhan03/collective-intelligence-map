import { expect, it } from "vitest";
import { publicTelemetryUrl } from "@/components/telemetry";
it("removes queries and fragments and excludes private pages from telemetry", () => {
  expect(
    publicTelemetryUrl(
      "https://example.com/maps/korea-vintage?query=secret#token",
    ),
  ).toBe("https://example.com/maps/korea-vintage");
  for (const path of [
    "/auth/callback?code=secret",
    "/login",
    "/admin/usage",
    "/u/person",
    "/saved",
  ])
    expect(publicTelemetryUrl(`https://example.com${path}`)).toBeNull();
});
