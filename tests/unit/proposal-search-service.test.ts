import { beforeEach, expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  regional: vi.fn(),
  aliases: vi.fn(),
  map: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: mock.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ in: async () => ({ data: [], error: null }) }),
      }),
    }),
  }),
}));
vi.mock("@/server/places/search-map", () => ({ getSearchMap: mock.map }));
vi.mock("@/server/places/provider-router", () => ({
  routeProvider: () => ({
    name: "overture",
    adapter: { search: mock.regional },
  }),
}));
vi.mock("@/server/places/gemini-search-alias", () => ({
  canTranslateJapanese: (_q: string, country: string) => country === "JP",
  japaneseSearchAliases: mock.aliases,
}));
vi.mock("@/server/events", () => ({ productEvent: vi.fn() }));
import { searchPlaces } from "@/server/places/search-service";
const viewer = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  handle: "test",
  bio: "",
  avatar_path: null,
  role: "member" as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.map.mockResolvedValue(demoMap);
  mock.rpc.mockResolvedValue({ data: [], error: null });
  mock.regional.mockResolvedValue([]);
  mock.aliases.mockResolvedValue(["古着"]);
});
it("calls internal RPC once and does not translate automatically", async () => {
  const r = await searchPlaces(
    { mapId: demoMap.id, query: "vintage", external: true },
    viewer,
  );
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  expect(mock.regional).toHaveBeenCalledTimes(1);
  expect(mock.aliases).not.toHaveBeenCalled();
  expect(r.translationAvailable).toBe(true);
});
it("stops before regional search when an internal match exists or external is false", async () => {
  mock.rpc.mockResolvedValueOnce({ data: [{ id: "place" }], error: null });
  await searchPlaces(
    { mapId: demoMap.id, query: "vintage", external: true },
    viewer,
  );
  await searchPlaces(
    { mapId: demoMap.id, query: "vintage", external: false },
    viewer,
  );
  expect(mock.regional).not.toHaveBeenCalled();
});
it("only explicit translation searches aliases and world scope never translates", async () => {
  await searchPlaces(
    { mapId: demoMap.id, query: "vintage", external: true, translate: true },
    viewer,
  );
  expect(mock.aliases).toHaveBeenCalledTimes(1);
  expect(mock.regional).toHaveBeenCalledTimes(2);
  mock.map.mockResolvedValue({
    ...demoMap,
    country: null,
    search_scope: "world",
  });
  const r = await searchPlaces(
    { mapId: demoMap.id, query: "vintage", external: true, translate: true },
    viewer,
  );
  expect(mock.aliases).toHaveBeenCalledTimes(1);
  expect(r.coverage).toBe("partial");
});

it("shares only live identical searches for the same viewer and removes completed jobs", async () => {
  let release!: () => void;
  mock.rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve({ data: [], error: null });
      }),
  );
  const input = { mapId: demoMap.id, query: "Shared", external: true };
  const first = searchPlaces(input, viewer);
  const second = searchPlaces({ ...input, query: "ＳＨＡＲＥＤ" }, viewer);
  expect(second).toBe(first);
  await vi.waitFor(() => expect(release).toBeDefined());
  release();
  await Promise.all([first, second]);
  expect(mock.regional).toHaveBeenCalledTimes(1);
  await searchPlaces(input, viewer);
  expect(mock.regional).toHaveBeenCalledTimes(2);
});
it("isolates live searches by viewer and clears failed searches", async () => {
  const input = { mapId: demoMap.id, query: "isolate", external: true };
  await Promise.all([
    searchPlaces(input, viewer),
    searchPlaces(input, {
      ...viewer,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }),
  ]);
  expect(mock.regional).toHaveBeenCalledTimes(2);
  mock.regional.mockRejectedValueOnce(new Error("limit"));
  await expect(searchPlaces(input, viewer)).rejects.toThrow("limit");
  await searchPlaces(input, viewer);
  expect(mock.regional).toHaveBeenCalledTimes(4);
});
