import { expect, type Page } from "@playwright/test";

/** The mobile map opens on a place list; pick the first place to get its card. */
export async function openFirstMobilePlace(page: Page) {
  await page
    .getByRole("button", { name: "장소 목록 펼치기", exact: true })
    .click();
  await page
    .locator(".mobile-place-overview .mobile-list-place")
    .first()
    .click();
  await expect(page.locator(".mobile-place-carousel")).toBeVisible();
}

/** Selecting a list item opens its summary; expanding it opens the detail. */
export async function expandMobileDetail(page: Page) {
  const name = await page
    .locator(".mobile-place-carousel")
    .getByRole("heading", { level: 2 })
    .innerText();
  await page
    .getByRole("button", { name: "장소 상세 펼치기", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: `${name} 장소 상세`, exact: true }),
  ).toBeVisible();
}
