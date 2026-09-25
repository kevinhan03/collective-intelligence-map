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
    isMobile ? "오늘은 어떤 곳을" : "좋은 장소는",
  );
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: /Tokyo Fashion/ }) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tokyo Fashion", exact: true }),
  ).toBeVisible();
  if (isMobile) {
    await expect(
      page.getByRole("button", { name: "지도 보기", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  } else {
    await expect(page.getByText("6개의 발견")).toBeVisible();
  }
  await page
    .getByRole("textbox", { name: "이 맵의 장소 검색" })
    .fill("Second Chapter");
  await expect(
    page.getByRole("option", { name: /Second Chapter/ }),
  ).toBeVisible();
  await page.getByRole("option", { name: /Second Chapter/ }).click();
  if (isMobile) {
    await expect(
      page.getByRole("button", { name: "Second Chapter 지도에서 선택" }),
    ).toBeVisible();
  } else {
    await expect(page.getByText("1개의 발견")).toBeVisible();
  }
  if (isMobile) {
    await page
      .getByRole("button", { name: "Second Chapter 지도에서 선택" })
      .click();
    await page
      .getByRole("complementary", { name: "Second Chapter 미리보기" })
      .getByRole("button", { name: "자세히 보기", exact: true })
      .click();
  } else {
    await page
      .getByRole("button", { name: "Second Chapter", exact: true })
      .click();
  }
  await expect(
    page.getByRole(isMobile ? "dialog" : "complementary", {
      name: "Second Chapter 장소 상세",
    }),
  ).toBeVisible();
  await expect(page.getByText("이 테마에 추천하는 이유")).toBeVisible();
  await expect(page.getByRole("button", { name: "적합해요 0" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "이 맵의 장소 검색" })
    .fill("not-a-place");
  if (isMobile) {
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "아직 발견된 장소가 없어요." }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "이 맵의 장소 검색" }).fill("");
  if (isMobile) {
    await page.getByRole("button", { name: "지도 보기", exact: true }).click();
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
  ).toBe(403);
  expect(
    (
      await request.get(
        "/api/maps/missing/places?west=0&east=1&south=0&north=1",
      )
    ).status(),
  ).toBe(404);
});

test("mobile discovery filters and recovers from empty results", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile discovery surface");
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "테마 지도 검색" })
    .fill("no-matching-theme");
  await expect(page.getByText("조건에 맞는 지도가 아직 없어요.")).toBeVisible();
  await page.getByRole("button", { name: "전체 지도 보기" }).click();
  await expect(
    page.getByRole("heading", { name: "Tokyo Fashion", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "테마 지도 검색" })
    .fill("Tokyo Fashion");
  await expect(page.getByRole("status")).toHaveText("1개");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "모바일 주요 메뉴" })
      .getByRole("link", { name: "발견" }),
  ).toHaveAttribute("aria-current", "page");
});

test("mobile view switching preserves scroll position and detail returns focus", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile view switching");
  await page.goto("/maps/tokyo-fashion");
  const list = page.getByRole("region", { name: "장소 목록" });
  const map = page.getByRole("region", { name: "장소 지도" });
  await expect(map).toBeVisible();
  await expect(list).toBeHidden();
  const mapBox = await map.boundingBox();
  const viewport = page.viewportSize();
  expect(mapBox?.height).toBeGreaterThan((viewport?.height ?? 0) * 0.75);
  await expect(
    page.getByText(
      "도쿄의 패션을 발견하는 사람들의 공개 지도. 독립 편집숍부터 빈티지 아카이브까지, 함께 추천하고 검증합니다.",
    ),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Tokyo Fashion 지도 정보 보기" })
    .click();
  const mapInfo = page.getByRole("dialog", { name: "Tokyo Fashion" });
  await expect(mapInfo).toBeVisible();
  await expect(mapInfo.getByText("커뮤니티 규칙 보기")).toBeVisible();
  await expect(mapInfo.getByRole("link", { name: "장소 제안" })).toBeVisible();
  await page.getByRole("button", { name: "지도 정보 닫기" }).click();
  await expect(mapInfo).toBeHidden();
  await page
    .getByRole("button", { name: "Second Chapter 지도에서 선택" })
    .click();
  const preview = page.getByRole("complementary", {
    name: "Second Chapter 미리보기",
  });
  await expect(preview).toBeVisible();
  await expect(
    preview.getByRole("button", { name: /Second Chapter 테마에 잘 맞아요/ }),
  ).toBeDisabled();
  await expect(
    preview.getByRole("button", { name: /Second Chapter 테마와 달라요/ }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toBeHidden();
  await preview
    .getByRole("button", { name: "자세히 보기", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: "Second Chapter 장소 상세" });
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "저장 불가" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "장소 상세 닫기" }).click();
  await expect(detail).toBeHidden();
  await expect(preview).toBeVisible();
  await preview.getByRole("button", { name: "장소 미리보기 닫기" }).click();
  await expect(preview).toBeHidden();
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(page.getByText("6개의 발견")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Second Chapter", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sunday Vintage", exact: true })
    .scrollIntoViewIfNeeded();
  const scrollTop = await list.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await page.getByRole("button", { name: "지도 보기", exact: true }).click();
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  expect(await list.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("mobile theme entry and saved-place deep links open the intended context", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile entry points");
  await page.goto("/");
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "Tokyo Fashion", exact: true }),
    })
    .click();
  await expect(
    page.getByRole("button", { name: "지도 보기", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(page.getByText("6개의 발견")).toBeVisible();
  await page.goto(
    "/maps/tokyo-fashion?place=33333333-3333-4333-8333-000000000001",
  );
  await expect(
    page.getByRole("dialog", { name: "Archive Room 장소 상세" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "장소 상세 닫기" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
