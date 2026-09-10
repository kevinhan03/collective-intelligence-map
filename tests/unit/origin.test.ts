import { expect, it } from "vitest";
import { sameOrigin } from "@/domain/request-origin";
it("accepts configured public origin behind a rewritten Next server URL", () => {
  expect(
    sameOrigin(
      "http://127.0.0.1:3000",
      "http://localhost:3000/api/community",
      "http://127.0.0.1:3000",
    ),
  ).toBe(true);
});
it("rejects missing and foreign origins, including host-like URL suffixes", () => {
  for (const origin of [
    null,
    "https://evil.test",
    "https://app.example.com.evil.test",
  ])
    expect(
      sameOrigin(origin, "http://internal:3000/api", "https://app.example.com"),
    ).toBe(false);
});
