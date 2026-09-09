import { expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), route: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/server/queries", () => ({ getMaps: async () => [demoMap] }));
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
  expect(result).toEqual({ internal: [], candidates: [] });
  expect(mocks.route).not.toHaveBeenCalled();
});
