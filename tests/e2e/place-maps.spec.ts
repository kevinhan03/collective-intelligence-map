import { expect, test } from "@playwright/test";
import { demoMap, demoPlaces } from "../../src/server/demo";

test("place detail lists all containing maps without photos and opens the same place", async ({
  page,
  isMobile,
}) => {
  const place = demoPlaces[0];
  await page.route(`**/api/places/${place.place_id}/maps`, (route) =>
    route.fulfill({
      json: {
        maps: [
          {
            ...demoMap,
            id: "other",
            slug: "other-map",
            title: "도쿄 편집숍 산책",
          },
          demoMap,
          {
            ...demoMap,
            id: "third",
            slug: "third-map",
            title: "주말 쇼핑 지도",
          },
        ],
      },
    }),
  );
  await page.goto(`/maps/${demoMap.slug}?place=${place.place_id}`);
  const section = page.getByRole("region", {
    name: "이 장소가 포함된 지도",
    exact: true,
  });
  await section.getByRole("heading", { level: 3 }).scrollIntoViewIfNeeded();
  await expect(section.getByRole("link")).toHaveCount(3);
  await expect(section.getByRole("link").first()).toContainText("현재 지도");
  await expect(section.locator("img")).toHaveCount(0);
  const link = section
    .getByRole("link")
    .filter({ hasText: "도쿄 편집숍 산책" });
  await expect(link).toHaveAttribute(
    "href",
    `/maps/other-map?place=${place.place_id}`,
  );
  await expect(link).toBeVisible();
  await page.screenshot({
    path: `/tmp/place-maps-${isMobile ? "mobile" : "desktop"}.png`,
  });
  await link.click();
  await expect(page).toHaveURL(`/maps/other-map?place=${place.place_id}`);
});

test("place maps API validates the place ID and returns real demo membership", async ({
  request,
}) => {
  const response = await request.get(
    `/api/places/${demoPlaces[0].place_id}/maps`,
  );
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ maps: [{ id: demoMap.id }] });
  expect((await request.get("/api/places/not-an-id/maps")).status()).toBe(400);
  const empty = await request.get(
    "/api/places/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/maps",
  );
  expect(await empty.json()).toEqual({ maps: [] });
});
