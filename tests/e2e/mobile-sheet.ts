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

/**
 * Move the place card to its neighbour the way a visitor does: drag the title.
 * The card is swipe-driven (the track no longer scrolls), so tests must drag
 * rather than set scrollLeft. Mouse input exercises the same pointer handlers
 * in the desktop and mobile projects.
 */
export async function swipeMobilePlace(
  page: Page,
  direction: "next" | "previous",
) {
  const card = page.locator(".mobile-place-carousel");
  const title = card.getByRole("heading", { level: 2 });
  const before = await title.innerText();
  // A swipe is ignored while the previous place is still animating out.
  await expect
    .poll(() =>
      card.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  const box = (await title.boundingBox())!;
  const y = box.y + box.height / 2;
  const x = box.x + box.width * (direction === "next" ? 0.75 : 0.25);
  const distance = direction === "next" ? -90 : 90;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + distance, y, { steps: 8 });
  await page.mouse.up();
  await expect(title).not.toHaveText(before);
}
