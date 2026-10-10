import { beforeEach, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ configured: () => true }));
vi.mock("@/lib/supabase/public", () => ({ publicDb: vi.fn() }));
import { publicDb } from "@/lib/supabase/public";
import { getPublicInventory } from "@/server/seo-queries";
const chain = {
  select: vi.fn(),
  in: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ["select", "in", "eq", "order"] as const)
    chain[key].mockReturnValue(chain);
  vi.mocked(publicDb).mockReturnValue({
    from: vi.fn(() => chain),
  } as unknown as ReturnType<typeof publicDb>);
});
it("reads beyond 500 rows with public statuses and active joined places, without vote statistics", async () => {
  const row = (i: number) => ({
    id: `map-place-${i}`,
    place_id: `place-${i}`,
    map_id: "map-1",
    created_at: "2026-10-10",
    rationale: "추천 이유",
    places: {
      name: `place ${i}`,
      address: "서울 용산구",
      category: "빈티지",
      status: "active",
    },
  });
  chain.range
    .mockResolvedValueOnce({
      data: Array.from({ length: 500 }, (_, i) => row(i)),
      error: null,
    })
    .mockResolvedValueOnce({ data: [row(500)], error: null });
  const inventory = await getPublicInventory(["map-1"]);
  expect(inventory).toHaveLength(501);
  expect(inventory[500].place_id).toBe("place-500");
  expect(chain.range.mock.calls).toEqual([
    [0, 499],
    [500, 999],
  ]);
  expect(chain.in).toHaveBeenCalledWith("status", ["approved", "disputed"]);
  expect(chain.in).toHaveBeenCalledWith("map_id", ["map-1"]);
  expect(chain.eq).toHaveBeenCalledWith("places.status", "active");
  expect(chain.select.mock.calls[0][0]).not.toMatch(
    /place_stats|positive|negative/,
  );
  expect(chain.order).toHaveBeenCalledWith("id");
});
it("does not query arbitrary inventory for an empty set of published maps", async () => {
  expect(await getPublicInventory([])).toEqual([]);
  expect(publicDb).not.toHaveBeenCalled();
});
it("preserves database failures instead of publishing an empty successful listing", async () => {
  chain.range.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
  await expect(getPublicInventory(["map-1"])).rejects.toThrow(
    "사이트맵 장소 목록을 불러오지 못했습니다.",
  );
});
