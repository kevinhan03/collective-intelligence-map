import { expect, test } from "@playwright/test";
import { openFirstMobilePlace } from "./mobile-sheet";
test("mobile carousel renders only nearby card content and keeps navigation aligned", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const summaries = page.locator(".mobile-place-summary");
  const slides = page.locator(".mobile-place-slide");
  const total = await slides.count();
  expect(await summaries.count()).toBe(Math.min(2, total));
  if (total > 1) {
    await page.getByRole("button", { name: "다음 장소", exact: true }).click();
    expect(await summaries.count()).toBeLessThanOrEqual(3);
    await expect
      .poll(() =>
        page.locator(".mobile-place-track").evaluate((track) => {
          const current = track.querySelector<HTMLElement>(
            '[aria-hidden="false"]',
          );
          const first = track.children[0] as HTMLElement;
          return current
            ? Math.abs(
                track.scrollLeft - (current.offsetLeft - first.offsetLeft),
              )
            : 999;
        }),
      )
      .toBeLessThan(2);
    await page.getByRole("button", { name: "이전 장소", exact: true }).click();
    expect(await summaries.count()).toBe(Math.min(2, total));
  }
});
