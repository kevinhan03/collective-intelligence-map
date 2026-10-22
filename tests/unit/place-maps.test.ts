import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ configured: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ configured: mocks.configured }));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () =>
    createClient("https://example.supabase.co", "public-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
}));
import { getPlaceMaps } from "@/server/place-maps";
import { demoMap, demoPlaces } from "@/server/demo";

const fetchMock = vi.fn();
beforeEach(() => {
  mocks.configured.mockReturnValue(true);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("looks up physical place membership with public-only visibility filters", async () => {
  const other = {
    ...demoMap,
    id: "other-map",
    slug: "other-map",
    kind: "creator",
  };
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify([
        { theme_maps: demoMap, places: { id: demoPlaces[0].place_id } },
        { theme_maps: other, places: { id: demoPlaces[0].place_id } },
      ]),
    ),
  );
  expect(await getPlaceMaps(demoPlaces[0].place_id)).toMatchObject([
    { id: demoMap.id },
    { id: "other-map", kind: "creator" },
  ]);
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.searchParams.get("place_id")).toBe(`eq.${demoPlaces[0].place_id}`);
  expect(url.searchParams.get("status")).toBe("in.(approved,disputed)");
  expect(url.searchParams.get("places.status")).toBe("eq.active");
  expect(url.searchParams.get("theme_maps.status")).toBe("eq.published");
  expect(url.searchParams.get("theme_maps.hidden_at")).toBe("is.null");
});

it("does not silently truncate a place that belongs to many maps", async () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    theme_maps: { ...demoMap, id: `map-${i}` },
    places: { id: demoPlaces[0].place_id },
  }));
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify(rows)))
    .mockResolvedValueOnce(
      new Response(JSON.stringify([{ theme_maps: demoMap, places: {} }])),
    );
  expect(await getPlaceMaps(demoPlaces[0].place_id)).toHaveLength(101);
  const url = new URL(String(fetchMock.mock.calls[1][0]));
  expect(url.searchParams.get("offset")).toBe("100");
});

it("reports lookup failures instead of claiming that no maps include the place", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ code: "42501", message: "denied" }), {
      status: 403,
    }),
  );
  await expect(getPlaceMaps(demoPlaces[0].place_id)).rejects.toThrow(
    "불러오지 못했습니다",
  );
});

it("returns only memberships that actually exist in the demo", async () => {
  mocks.configured.mockReturnValue(false);
  expect(await getPlaceMaps(demoPlaces[0].place_id)).toMatchObject([
    { id: demoMap.id },
  ]);
  expect(await getPlaceMaps("unknown-place")).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
});
