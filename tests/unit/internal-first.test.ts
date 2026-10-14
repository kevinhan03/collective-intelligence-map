import { expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
import { searchSchema } from "@/domain/validation";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  route: vi.fn(),
  mapRows: [] as { id: string; place_id: string; status: string }[],
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: mocks.mapRows, error: null }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/server/places/search-map", () => ({
  getSearchMap: async () => demoMap,
}));
vi.mock("@/server/places/provider-router", () => ({
  routeProvider: mocks.route,
}));
import { searchPlaces } from "@/server/places/search-service";
it("internal search never touches an external provider, including zero hits", async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  const result = await searchPlaces(
    { mapId: demoMap.id, query: "없는 장소", external: false },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      handle: "tester",
      role: "contributor",
      bio: "",
      avatar_path: null,
    },
  );
  expect(result).toMatchObject({
    internal: [],
    candidates: [],
    translationAvailable: false,
  });
  expect(mocks.route).not.toHaveBeenCalled();
});

it("allows short queries for both internal and external search", () => {
  expect(
    searchSchema.parse({ mapId: demoMap.id, query: "ab", external: true }),
  ).toMatchObject({ query: "ab", external: true });
  expect(
    searchSchema.parse({ mapId: demoMap.id, query: "ab", external: false }),
  ).toMatchObject({ query: "ab", external: false });
});

it("shows external branches alongside an internal name match", async () => {
  vi.stubEnv("PROVIDER_SIGNING_SECRET", "x".repeat(32));
  mocks.route.mockClear();
  const search = vi.fn().mockResolvedValue([
    {
      provider: "overture",
      externalId: "other-branch",
      label: "Shop",
      address: "서울 마포구",
      attribution: "Overture Maps",
    },
  ]);
  mocks.route.mockReturnValue({ name: "overture", adapter: { search } });
  mocks.rpc.mockResolvedValue({
    data: [{ id: "internal", name: "Shop" }],
    error: null,
  });
  try {
    const result = await searchPlaces(
      { mapId: demoMap.id, query: "Shop", external: true },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        handle: "tester",
        role: "member",
        bio: "",
        avatar_path: null,
      },
    );
    expect(result.internal).toHaveLength(1);
    expect(result.internal[0]).toMatchObject({ currentMapPlaceId: null });
    expect(result.candidates).toMatchObject([{ externalId: "other-branch" }]);
    expect(search).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllEnvs();
  }
});

it("marks a place already proposed on the current map", async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id: "internal", name: "Shop" }],
    error: null,
  });
  mocks.mapRows = [{ id: "proposal", place_id: "internal", status: "pending" }];
  const result = await searchPlaces(
    { mapId: demoMap.id, query: "Shop", external: false },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      handle: "tester",
      role: "member",
      bio: "",
      avatar_path: null,
    },
  );
  expect(result.internal[0]).toMatchObject({
    currentMapPlaceId: "proposal",
    currentMapStatus: "pending",
  });
  mocks.mapRows = [];
});
