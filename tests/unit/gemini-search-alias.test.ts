import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      }),
      upsert: mocks.upsert,
    }),
  }),
}));

import { japaneseSearchAliases } from "@/server/places/gemini-search-alias";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("skips Gemini for Japanese queries", async () => {
  expect(await japaneseSearchAliases("コモリ", "JP")).toEqual([]);
  expect(mocks.maybeSingle).not.toHaveBeenCalled();
});

it("does not cache missing-key failures", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  vi.stubEnv("GEMINI_API_KEY", "");
  await expect(japaneseSearchAliases("missing shop", "JP", "user")).rejects.toThrow("일시적으로");
  expect(mocks.upsert).not.toHaveBeenCalled();
});

it("does not call Gemini when the reservation is denied", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  vi.stubEnv("GEMINI_API_KEY", "test");
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(japaneseSearchAliases("missing shop", "JP", "user")).rejects.toThrow("요청이 많습니다");
  expect(fetch).not.toHaveBeenCalled();
});

it("regenerates expired entries and never caches provider failure", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: { japanese_queries: [], updated_at: "2020-01-01" }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  vi.stubEnv("GEMINI_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(japaneseSearchAliases("missing shop", "JP", "user")).rejects.toThrow("일시적으로");
  expect(mocks.upsert).not.toHaveBeenCalled();
});

it("returns a cached translation without calling Gemini", async () => {
  mocks.maybeSingle.mockResolvedValueOnce({ data: { japanese_queries: ["コモリ"], updated_at: new Date().toISOString() }, error: null });
  expect(await japaneseSearchAliases("COMOLI", "JP")).toEqual(["コモリ"]);
});
