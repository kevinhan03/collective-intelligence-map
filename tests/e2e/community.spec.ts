import { test, expect } from "@playwright/test";
test("discover community, filter venues, open context and protect participation", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/places\.googleapis|dapi\.kakao/.test(r.url())) external.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "좋은 장소는",
  );
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: "Tokyo Fashion" }) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tokyo Fashion", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("6개의 발견")).toBeVisible();
  await page.getByRole("button", { name: "빈티지", exact: true }).click();
  await expect(page.getByText("2개의 발견")).toBeVisible();
  await page
    .getByRole("button", { name: "Second Chapter", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Why it belongs here")).toBeVisible();
  await expect(page.getByRole("button", { name: "적합해요 0" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "전체", exact: true }).click();
  await page
    .getByRole("textbox", { name: "이 맵의 장소 검색" })
    .fill("not-a-place");
  await expect(
    page.getByRole("heading", { name: "아직 발견된 장소가 없어요." }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "이 맵의 장소 검색" }).fill("");
  if (isMobile) {
    await expect(
      page.getByRole("button", { name: "Archive Room 지도에서 선택" }),
    ).toBeVisible();
  }
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("proposal and Google login honestly report unavailable connections", async ({
  page,
}) => {
  await page.goto("/maps/tokyo-fashion/submit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "나만 알기",
  );
  await expect(
    page.getByRole("textbox", { name: "제안할 장소 검색" }),
  ).toBeDisabled();
  await page.goto("/saved");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("button", { name: "Google로 계속하기" }),
  ).toBeDisabled();
});
test("server rejects unauthenticated mutations and unknown maps", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/community", {
        data: { action: "vote", id: "x", value: 1 },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get(
        "/api/maps/missing/places?west=0&east=1&south=0&north=1",
      )
    ).status(),
  ).toBe(404);
});
