import { test, expect, type Page } from "@playwright/test";
import type { MapSearchResult, SearchStation } from "@/domain/map-search";
import type { MapPlace } from "@/domain/types";

const station: SearchStation = {
  id: "station-test",
  name: "검색역",
  local_name: "検索駅",
  kind: "subway",
  region: "tokyo",
  lat: 35.66,
  lng: 139.7,
};
const place = (index: number): MapPlace => ({
  id: `remote-${index}`,
  place_id: `remote-place-${index}`,
  map_id: "map",
  name: `Remote Place ${index}`,
  address: "Tokyo",
  category: "thrift_store",
  lat: 35.66 + index / 10000,
  lng: 139.7,
  rationale: "검색으로 찾은 장소입니다",
  status: "approved",
  added_by: null,
  handle: "test",
  positive: 0,
  negative: 0,
  saved_count: 0,
  created_at: "2026-01-01",
  last_verified_at: null,
});
const response = (
  overrides: Partial<MapSearchResult> = {},
): MapSearchResult => ({
  mode: "full",
  items: [place(525)],
  total: 1,
  hasMore: false,
  suggestions: [],
  station: null,
  stationsStatus: "ready",
  ...overrides,
});
async function open(page: Page, mobile: boolean) {
  await page.goto("/maps/tokyo-fashion");
  if (mobile) {
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await page.getByRole("button", { name: "장소 검색 열기" }).click();
  }
  return page.getByRole("combobox", { name: "이 맵의 장소 검색", exact: true });
}
test("map-wide search loads places outside the initial inventory and paginates before sorting", async ({
  page,
  isMobile,
}) => {
  const offsets: number[] = [];
  await page.route("**/api/maps/*/search?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const offset = Number(params.get("offset"));
    offsets.push(offset);
    const items = Array.from({ length: offset === 0 ? 20 : 5 }, (_, i) =>
      place(offset + i + 501),
    );
    return route.fulfill({
      json: response({ items, total: 25, hasMore: offset === 0 }),
    });
  });
  const input = await open(page, isMobile);
  await input.fill("remote");
  await expect(
    page.getByText("지도 전체 공개 장소 검색", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#explorer-list article")).toHaveCount(20);
  await page.getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(page.locator("#explorer-list article")).toHaveCount(25);
  expect(offsets).toEqual([0, 20]);
  await expect(page.locator("#explorer-list")).toContainText(
    "Remote Place 525",
  );
  await page.getByRole("button", { name: "검색·역 필터 초기화" }).click();
  await expect(input).toHaveValue("");
  await expect(page.locator("#explorer-list")).toContainText("Archive Room");
});
test("station suggestions require selection, support keyboard and combine with text filters", async ({
  page,
  isMobile,
}, testInfo) => {
  const requests: URLSearchParams[] = [];
  await page.route("**/api/maps/*/search?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    return route.fulfill({
      json: params.has("stationId")
        ? response({
            station,
            items: [{ ...place(525), station_distance_m: 1250 }],
          })
        : response({
            items: [],
            total: 0,
            suggestions: [{ term: station.name, kind: "station", station }],
          }),
    });
  });
  const input = await open(page, isMobile);
  await input.fill("검색역");
  await expect(page.getByRole("option", { name: /검색역/ })).toBeVisible();
  expect(requests.every((p) => !p.has("stationId"))).toBe(true);
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    "map-search-option-0",
  );
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: "역 필터 해제" }),
  ).toContainText("검색역 주변 2km");
  await expect(
    page.getByText("검색역 · 직선거리 1.3km", { exact: true }),
  ).toBeVisible();
  await input.fill("빈티지");
  await expect
    .poll(() =>
      requests.some(
        (p) => p.get("stationId") === station.id && p.get("q") === "빈티지",
      ),
    )
    .toBe(true);
  await expect(
    page.getByText("지도 전체 공개 장소 검색", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("station-search.png"),
    fullPage: true,
  });
  if (isMobile) {
    await page.getByRole("button", { name: "지도 보기", exact: true }).click();
    await expect(input).toHaveValue("빈티지");
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await expect(page.locator("#explorer-list")).toContainText(
      "Remote Place 525",
    );
  }
  await page.getByRole("button", { name: "검색·역 필터 초기화" }).click();
  await expect(page.getByRole("button", { name: "역 필터 해제" })).toHaveCount(
    0,
  );
});
test("composition delays requests and late responses cannot replace new results", async ({
  page,
  isMobile,
}) => {
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queries: string[] = [];
  await page.route("**/api/maps/*/search?*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q")!;
    queries.push(q);
    if (q === "old") await delayed;
    await route
      .fulfill({
        json: response({
          items: [
            { ...place(1), name: q === "old" ? "Old result" : "New result" },
          ],
        }),
      })
      .catch(() => {});
  });
  const input = await open(page, isMobile);
  await input.dispatchEvent("compositionstart");
  await input.fill("old");
  await page.waitForTimeout(450);
  expect(queries).toEqual([]);
  await input.dispatchEvent("compositionend");
  await expect.poll(() => queries.includes("old")).toBe(true);
  await input.fill("new");
  await expect(page.locator("#explorer-list")).toContainText("New result");
  release();
  await expect(page.locator("#explorer-list")).not.toContainText("Old result");
});
test("search failure retries and missing RPC reports the local search scope", async ({
  page,
  isMobile,
}) => {
  let status = "fail";
  await page.route("**/api/maps/*/search?*", (route) =>
    route.fulfill(
      status === "fail"
        ? { status: 503, json: { error: "테스트 검색 실패" } }
        : { json: response({ mode: status === "local" ? "local" : "full" }) },
    ),
  );
  const input = await open(page, isMobile);
  await input.fill("remote");
  await expect(
    page.getByRole("alert").filter({ hasText: "테스트 검색 실패" }),
  ).toBeVisible();
  status = "success";
  await page.getByRole("button", { name: "검색 재시도" }).click();
  await expect(page.locator("#explorer-list")).toContainText(
    "Remote Place 525",
  );
  status = "local";
  await input.fill("archive");
  await expect(
    page.getByText("현재 불러온 장소 내 검색", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#explorer-list")).toContainText("Archive Room");
});
