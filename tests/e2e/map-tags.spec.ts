import { expect, test } from "@playwright/test";
const vintage = "aaaa1111-1111-4111-8111-111111111111";
const archive = "aaaa4444-4444-4444-8444-444444444444";
test("tags combine with AND, preserve URL history, and reset", async ({
  page,
  isMobile,
}, info) => {
  await page.goto("/maps/tokyo-fashion");
  const bar = page.getByRole("group", { name: "장소 태그 필터" });
  await expect(bar).toBeVisible();
  const chip = bar.getByRole("button", { name: "#빈티지", exact: true });
  await expect(chip).toHaveCSS("font-size", "14px");
  await expect(chip).toHaveCSS("height", "36px");
  await expect(chip).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(chip).toHaveCSS("height", "36px");
  await expect(page).toHaveURL(new RegExp(`tag=${vintage}`));
  await expect(page.locator(".map-pin")).toHaveCount(3);
  await bar.getByRole("button", { name: "#아카이브", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(1);
  await expect(page.locator(".map-pin")).toHaveAttribute(
    "aria-label",
    /Archive Room/,
  );
  expect(new URL(page.url()).searchParams.getAll("tag")).toEqual([
    vintage,
    archive,
  ]);
  await page.screenshot({
    path: info.outputPath(`tags-${isMobile ? "mobile" : "desktop"}.png`),
  });
  await page.reload();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-pin")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator(".map-pin")).toHaveCount(3);
  await bar.getByRole("button", { name: "전체", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(6);
  expect(new URL(page.url()).searchParams.has("tag")).toBe(false);
});
test("invalid tags are removed and disjoint tags show no results", async ({
  page,
  isMobile,
}) => {
  await page.goto("/maps/tokyo-fashion?tag=invalid");
  const bar = page.getByRole("group", { name: "장소 태그 필터" });
  await expect(
    bar.getByRole("button", { name: "전체", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tokyo-fashion$/);
  await bar.getByRole("button", { name: "#빈티지", exact: true }).click();
  await bar.getByRole("button", { name: "#편집숍", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(0);
  if (isMobile)
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "조건에 맞는 장소가 없어요." })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "검색 조건 초기화", exact: true })
    .first()
    .click();
  await expect(page.locator(".map-pin")).toHaveCount(6);
});
