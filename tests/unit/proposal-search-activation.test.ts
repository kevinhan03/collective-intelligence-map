import { beforeEach, expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
const mocks = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  ready: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mocks.row, error: null }),
          }),
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
  mocks.row = { ...demoMap };
  mocks.ready.mockReset();
});
it("keeps existing region maps usable before migration", async () => {
  expect((await getSearchMap(demoMap.id)).search_scope).toBe("region");
  expect(mocks.ready).not.toHaveBeenCalled();
});
it("blocks expanded scopes until activation RPC is available", async () => {
  mocks.row = { ...demoMap, country: null, search_scope: "world" };
  mocks.ready.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  await expect(getSearchMap(demoMap.id)).rejects.toThrow("DB 적용 완료");
  mocks.ready.mockResolvedValue({ data: true, error: null });
  expect((await getSearchMap(demoMap.id)).country).toBeNull();
});
