import { expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
const mocks = vi.hoisted(() => ({
  search: vi
    .fn()
    .mockResolvedValue([
      {
        provider: "kakao",
        externalId: "k1",
        label: "국내 테스트 장소",
        address: "직접 입력 아님",
        lat: 37.55,
        lng: 126.99,
        category: "카페",
        attribution: "Kakao Maps",
      },
    ]),
}));
vi.mock("@/server/places/search-map", () => ({
  getSearchMap: async () => ({
    ...demoMap,
    country: "KR",
    bounds: { west: 126, south: 37, east: 128, north: 38 },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: async () => ({ data: [], error: null }) }),
}));
vi.mock("@/server/places/canonical-resolver", () => ({
  resolveExistingPlaceDetails: async () => null,
}));
vi.mock("@/server/places/provider-router", () => ({
  routeProvider: () => ({
    name: "kakao",
    adapter: { search: mocks.search, details: async (c: unknown) => c },
  }),
}));
vi.mock("@/server/places/usage", () => ({
  metered: async (_: unknown, run: () => unknown) => run(),
}));
import { searchPlaces, selectCandidate } from "@/server/places/search-service";
import { verifyCandidate } from "@/server/places/candidate-token";
it("preserves signed transient Kakao coordinates without Google details or DB promotion", async () => {
  vi.stubEnv("PROVIDER_SIGNING_SECRET", "x".repeat(32));
  const viewer = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    handle: "tester",
    role: "member" as const,
    bio: "",
    avatar_path: null,
  };
  try {
    const results = await searchPlaces(
      { mapId: demoMap.id, query: "테스트 장소", external: true },
      viewer,
    );
    const selected = await selectCandidate(
      results.candidates[0].token!,
      demoMap.id,
      viewer,
    );
    expect(selected.placeId).toBeNull();
    expect(selected.candidate).toMatchObject({
      provider: "kakao",
      lat: 37.55,
      lng: 126.99,
      label: "국내 테스트 장소",
    });
    expect(
      verifyCandidate(selected.candidate.token, viewer.id, demoMap.id),
    ).toMatchObject({ selected: true, category: "카페" });
    await expect(
      selectCandidate(results.candidates[0].token!, demoMap.id, {
        ...viewer,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ).rejects.toThrow();
  } finally {
    vi.unstubAllEnvs();
  }
});
