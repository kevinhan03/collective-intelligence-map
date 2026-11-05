import { beforeEach, expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";

const mocks = vi.hoisted(() => ({
  row: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
  settings: vi.fn(),
  tags: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ configured: () => true }));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: mocks.row }),
          maybeSingle: mocks.profile,
          order: mocks.row,
        }),
      }),
    }),
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/server/catalog-read", () => ({
  readCatalogSettings: mocks.settings,
  resolveEditorial: () => ({}),
}));
vi.mock("@/server/map-tags", () => ({ getMapTagCatalog: mocks.tags }));
import { getMap, getMaps } from "@/server/queries";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.row.mockResolvedValue({ data: demoMap, error: null });
  mocks.profile.mockResolvedValue({ data: { handle: "creator" }, error: null });
  mocks.settings.mockResolvedValue([]);
  mocks.tags.mockResolvedValue({ tags: [] });
  mocks.rpc.mockResolvedValue({
    data: { place_count: 3, follower_count: 2, contributor_count: 1 },
    error: null,
  });
});

it("starts creator, editorial and tag reads while statistics are still pending", async () => {
  let release!: (value: unknown) => void;
  mocks.row.mockResolvedValue({
    data: { ...demoMap, kind: "creator", owner_id: "owner" },
    error: null,
  });
  mocks.rpc.mockReturnValue(new Promise((resolve) => (release = resolve)));
  const pending = getMap(demoMap.slug);
  // A blocked statistics RPC must not prevent the other reads from starting.
  await vi.waitFor(() => {
    expect(mocks.profile).toHaveBeenCalledOnce();
    expect(mocks.settings).toHaveBeenCalledOnce();
    expect(mocks.tags).toHaveBeenCalledWith(demoMap.id);
  });
  release({
    data: { place_count: 3, follower_count: 2, contributor_count: 1 },
    error: null,
  });
  expect(await pending).toMatchObject({
    id: demoMap.id,
    creator_handle: "creator",
    place_count: 3,
    place_tags: [],
  });
});

it("does not query detail enhancements for a missing map", async () => {
  mocks.row.mockResolvedValue({ data: null, error: null });
  expect(await getMap("missing")).toBeNull();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.settings).not.toHaveBeenCalled();
  expect(mocks.tags).not.toHaveBeenCalled();
});

it("starts catalog settings before the map list finishes", async () => {
  let release!: (value: unknown) => void;
  mocks.row.mockReturnValue(new Promise((resolve) => (release = resolve)));
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  const pending = getMaps();
  await vi.waitFor(() => expect(mocks.settings).toHaveBeenCalledOnce());
  release({ data: [demoMap], error: null });
  expect(await pending).toMatchObject([{ id: demoMap.id }]);
});
