import { beforeEach, expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
const mocks = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  ready: vi.fn(),
  user: "owner",
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: mocks.user } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.row, error: null }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({ rpc: mocks.ready }),
}));
import { getSearchMap } from "@/server/places/search-map";
beforeEach(() => {
  mocks.row = { ...demoMap, status: "published" };
  mocks.ready.mockReset();
});
it("keeps existing region maps usable before migration", async () => {
  expect((await getSearchMap(demoMap.id)).search_scope).toBe("region");
  expect(mocks.ready).not.toHaveBeenCalled();
});
it("blocks expanded scopes until activation RPC is available", async () => {
  mocks.row = {
    ...demoMap,
    status: "published",
    country: null,
    search_scope: "world",
  };
  mocks.ready.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  await expect(getSearchMap(demoMap.id)).rejects.toThrow("DB 적용 완료");
  mocks.ready.mockResolvedValue({ data: true, error: null });
  expect((await getSearchMap(demoMap.id)).country).toBeNull();
});

it("permits creator draft search only to its owner and rejects community drafts", async () => {
  mocks.row = {
    ...demoMap,
    status: "draft",
    kind: "creator",
    owner_id: "owner",
  };
  expect((await getSearchMap(demoMap.id)).id).toBe(demoMap.id);
  mocks.row = { ...mocks.row, owner_id: "other" };
  await expect(getSearchMap(demoMap.id)).rejects.toThrow("맵이 없습니다");
  mocks.row = { ...mocks.row, kind: "community", owner_id: "owner" };
  await expect(getSearchMap(demoMap.id)).rejects.toThrow("맵이 없습니다");
});
