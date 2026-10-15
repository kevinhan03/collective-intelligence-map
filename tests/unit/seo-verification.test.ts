import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function config(environment: string, url: string) {
  vi.resetModules();
  vi.stubEnv("VERCEL_ENV", environment);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("GOOGLE_SITE_VERIFICATION", " google-token ");
  vi.stubEnv("BING_SITE_VERIFICATION", " bing-token ");
  return import("@/lib/seo");
}

it("publishes ownership tags only for an indexable production origin", async () => {
  expect(
    (await config("production", "https://example.com")).siteVerification,
  ).toEqual({ google: "google-token", bing: "bing-token" });
  expect(
    (await config("preview", "https://preview.example.com")).siteVerification,
  ).toEqual({});
  expect(
    (await config("development", "http://localhost:3000")).siteVerification,
  ).toEqual({});
});

it("omits empty ownership tokens rather than generating placeholder claims", async () => {
  await config("production", "https://example.com");
  vi.stubEnv("GOOGLE_SITE_VERIFICATION", " ");
  vi.stubEnv("BING_SITE_VERIFICATION", "");
  vi.resetModules();
  expect((await import("@/lib/seo")).siteVerification).toEqual({
    google: undefined,
    bing: undefined,
  });
});

it("connects the Korean site name to English aliases at the canonical home URL", async () => {
  const seo = await config("production", "https://example.com/ignored-path");
  expect(seo.siteTitle).toContain("팅맵 (Ting map)");
  expect(seo.siteDescription).toContain("팅맵(Ting map)");
  expect(seo.websiteStructuredData).toMatchObject({
    "@type": "WebSite",
    name: "팅맵",
    alternateName: ["Ting map", "Tingmap"],
    url: "https://example.com/",
    "@id": "https://example.com/#website",
  });
  expect(
    (await config("development", "http://localhost:3000"))
      .websiteStructuredData,
  ).toBeNull();
});
