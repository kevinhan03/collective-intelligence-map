import { describe, expect, it } from "vitest";
import { jsonLd, placePath, publicOrigin } from "@/domain/seo";
describe("SEO public URLs and structured content", () => {
  it("keeps stable place IDs and safely encodes routes", () => {
    expect(placePath("테마 지도", "a/b")).toBe(
      "/maps/%ED%85%8C%EB%A7%88%20%EC%A7%80%EB%8F%84/places/a%2Fb",
    );
  });
  it("never embeds an executable script terminator from public text", () => {
    const value = { description: "</script><script>alert(1)</script>" };
    expect(jsonLd(value)).not.toContain("<");
    expect(JSON.parse(jsonLd(value))).toEqual(value);
  });
  it("only accepts public HTTPS origins without credentials", () => {
    expect(publicOrigin(undefined)).toBeNull();
    expect(publicOrigin("http://localhost:3000")).toBeNull();
    expect(publicOrigin("https://127.0.0.1")).toBeNull();
    expect(publicOrigin("https://user:password@example.com")).toBeNull();
    expect(publicOrigin("https://example.com/path?query=yes")).toBe(
      "https://example.com",
    );
  });
});
