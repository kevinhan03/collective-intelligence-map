import { expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
const mocks = vi.hoisted(() => ({ route: vi.fn() }));
vi.mock("@/server/queries", () => ({ getMaps: async () => [demoMap] }));
vi.mock("@/server/places/provider-router", () => ({ routeProvider: mocks.route }));
vi.mock("@/server/places/usage", () => ({
  metered: async (_args: unknown, run: () => unknown) => run(),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: async () => ({ data: [], error: null }) }),
}));
import { searchPlaces } from "@/server/places/search-service";

const viewer = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  handle: "tester",
  role: "contributor" as const,
  bio: "",
  avatar_path: null,
};

it("retries a zero-result Google search once in the other script", async () => {
  vi.stubEnv("PROVIDER_SIGNING_SECRET", "x".repeat(32));
  try {
    const search = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          provider: "google",
          externalId: "p1",
          label: "Found Shop",
          attribution: "Google Maps",
        },
      ]);
    mocks.route.mockReturnValue({ name: "google", adapter: { search } });
    const result = await searchPlaces(
      { mapId: demoMap.id, query: "존재하는샵", external: true },
      viewer,
    );
    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[0][1]).toMatchObject({ languageCode: "ko" });
    expect(search.mock.calls[1][1]).toMatchObject({ languageCode: "en" });
    expect(result.candidates).toHaveLength(1);
  } finally {
    vi.unstubAllEnvs();
  }
});

it("does not retry a non-Google provider (no language concept)", async () => {
  const search = vi.fn().mockResolvedValue([]);
  mocks.route.mockReturnValue({ name: "kakao", adapter: { search } });
  await searchPlaces(
    { mapId: demoMap.id, query: "no hits", external: true },
    viewer,
  );
  expect(search).toHaveBeenCalledTimes(1);
});
