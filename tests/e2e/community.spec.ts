import { test, expect } from "@playwright/test";
test("mobile logo stays visible after returning home from a map", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/");
  const logo = page.getByRole("link", { name: "Ting map 홈", exact: true });
  await expect(logo).toBeVisible();
  for (let i = 0; i < 2; i++) {
    const card = page.getByRole("button", {
      name: "Tokyo Fashion Store 미리보기",
      exact: true,
    });
    await card.click();
    await page
      .getByRole("button", {
        name: "Tokyo Fashion Store 전체 지도 열기",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/maps\/tokyo-fashion/);
    await expect(logo).toBeHidden();
    await page
      .getByRole("link", { name: "홈으로 돌아가기", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    await expect(logo).toBeVisible();
    await page
      .getByRole("button", {
        name: "Tokyo Fashion Store 미리보기 닫기",
        exact: true,
      })
      .click();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/maps\/tokyo-fashion/);
  await page.goForward();
  await expect(page).toHaveURL("/");
  await expect(logo).toBeVisible();
});
test("mobile home previews before navigation and search follows scroll direction", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 390, height: 400 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.getByRole("button", {
    name: "Tokyo Fashion Store 미리보기",
    exact: true,
  });
  const search = page.getByRole("searchbox", { name: "추천 지도 검색" });
  await expect(search).toBeVisible();
  await card.click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("region", { name: "Tokyo Fashion Store 미리보기 정보" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tokyo Fashion Store 미리보기 닫기" })
    .click();
  await expect(card).toBeFocused();
  await expect(
    page.getByRole("region", { name: "Tokyo Fashion Store 미리보기 정보" }),
  ).toBeHidden();
  await card.click();
  await page.evaluate(() => window.scrollTo(0, 150));
  await expect(search).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 80));
  await expect(search).toBeVisible();
  await search.click();
  await expect(search).toBeFocused();
  await search.fill("Tokyo");
  await expect(search).toHaveValue("Tokyo");
});
test("desktop header becomes solid after scrolling and restores at top", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile);
  await page.setViewportSize({ width: 1440, height: 600 });
  // Home reserves footer space even on short screens; use a naturally
  // scrollable page to exercise the shared header behavior.
  await page.goto("/discover");
  await expect(
    page.getByRole("heading", { name: "Tokyo Fashion Store", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      ),
    )
    .toBeGreaterThan(100);
  const header = page.locator(".glass-header");
  await expect(header).toHaveAttribute("data-scrolled", "false");
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect(header).toHaveAttribute("data-scrolled", "true");
  await expect(header).toHaveCSS("background-color", "rgb(23, 29, 37)");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).toHaveAttribute("data-scrolled", "false");
});

for (const viewport of [
  { width: 1024, height: 600 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 600 },
  { width: 1536, height: 864 },
]) {
  test(`home footer fits the ${viewport.width}x${viewport.height} viewport`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
    const footer = page.locator("footer");
    const [panelBox, footerBox] = await Promise.all([
      page.locator("#communities").boundingBox(),
      footer.boundingBox(),
    ]);
    expect(panelBox!.y + panelBox!.height).toBeLessThan(footerBox!.y);
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport.height);
    await expect(footer.getByRole("link", { name: "이용약관" })).toBeInViewport();
    await expect(footer.getByRole("link", { name: "개인정보 처리방침" })).toBeInViewport();
  });
}

test("mobile map search is optional and closing restores focus", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  const search = page.getByRole("textbox", { name: "이 맵의 장소 검색" });
  const trigger = page.getByRole("button", { name: "장소 검색 열기" });
  await expect(search).toBeHidden();
  await trigger.click();
  await expect(search).toBeFocused();
  await search.fill("Archive");
  await page.getByRole("button", { name: "장소 검색 닫기" }).click();
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(search).toHaveValue("Archive");
});
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
    isMobile ? "취향으로 찾는 테마지도" : "좋은 장소는",
  );
  if (isMobile) {
    await page
      .getByRole("button", {
        name: "Tokyo Fashion Store 미리보기",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL("/");
    await page
      .getByRole("button", {
        name: "Tokyo Fashion Store 전체 지도 열기",
        exact: true,
      })
      .click();
  } else {
    await page.locator('summary[aria-label="Tokyo Fashion Store 미리보기"]').click();
    await page
      .getByRole("link", { name: /전체 지도 열기.*Tokyo Fashion/ })
      .click();
  }
  // The mobile heading contains a button named "지도 정보 보기". Its
  // accessible name can include that action; the displayed map title is stable.
  const mapHeading = page.getByRole("heading", { level: 1 });
  await expect(mapHeading).toBeVisible();
  await expect(mapHeading).toHaveText("Tokyo Fashion Store");
  if (isMobile) {
    await expect(page.getByRole("region", { name: "장소 지도" })).toBeVisible();
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await expect(
      page.getByRole("article").filter({ hasText: "Archive Room" }),
    ).toContainText("시대를 읽는 옷");
    await page.getByRole("button", { name: "지도 보기", exact: true }).click();
  } else {
    await expect(page.getByText("6개의 발견")).toBeVisible();
    await expect(
      page.getByRole("article").filter({ hasText: "Archive Room" }),
    ).toContainText("시대를 읽는 옷");
  }
  if (isMobile)
    await page.getByRole("button", { name: "장소 검색 열기" }).click();
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
      .getByRole("article", { name: "Second Chapter 미리보기" })
      .getByRole("button", { name: "상세 보기", exact: true })
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
  await expect(page.getByRole("heading", { name: "방문자 사진", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "사진 추가", exact: true })).toBeDisabled();
  if (isMobile)
    await page
      .locator("summary")
      .filter({ hasText: "이 주제에 맞나요?" })
      .click();
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
test("my proposals requires login and preserves its return path", async ({
  page,
}) => {
  await page.goto("/my-proposals");
  await expect(page).toHaveURL(/\/login\?next=%2Fmy-proposals/);
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
    .getByRole("searchbox", { name: "추천 지도 검색" })
    .fill("no-matching-theme");
  await expect(page.getByText("조건에 맞는 지도가 아직 없어요.")).toBeVisible();
  await page.getByRole("button", { name: "검색 조건 초기화" }).click();
  await expect(
    page.getByRole("heading", { name: "Tokyo Fashion Store", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "추천 지도 검색" })
    .fill("Tokyo Fashion Store");
  await expect(page.getByRole("status")).toHaveText("1개 지도");
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
  expect(mapBox?.height).toBeGreaterThan((viewport?.height ?? 0) * 0.5);
  await expect(
    page.getByText(
      "도쿄의 패션을 발견하는 사람들의 공개 지도. 독립 편집숍부터 빈티지 아카이브까지, 함께 추천하고 검증합니다.",
    ),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Tokyo Fashion Store 지도 정보 보기" })
    .click();
  const mapInfo = page.getByRole("dialog", { name: "Tokyo Fashion Store" });
  await expect(mapInfo).toBeVisible();
  await expect(mapInfo.getByText("커뮤니티 규칙 보기")).toBeVisible();
  await expect(mapInfo.getByRole("link", { name: "장소 제안" })).toBeVisible();
  await page.getByRole("button", { name: "지도 정보 닫기" }).click();
  await expect(mapInfo).toBeHidden();
  await page
    .getByRole("button", { name: "Second Chapter 지도에서 선택" })
    .click();
  const preview = page.getByRole("article", {
    name: "Second Chapter 미리보기",
  });
  await expect(preview).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await preview.getByRole("button", { name: "상세 보기", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Second Chapter 장소 상세" });
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "저장 불가" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "장소 상세 닫기" }).click();
  await expect(detail).toBeHidden();
  await expect(preview).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "상세 보기" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(page.getByText("6개의 발견")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Second Chapter", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sunday Vintage", exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await list.evaluate((element) => getComputedStyle(element).overflowY),
  ).toBe("visible");
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "지도 보기", exact: true }).click();
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(page.getByText("6개의 발견")).toBeVisible();
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
    .getByRole("button", { name: "Tokyo Fashion Store 미리보기", exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "Tokyo Fashion Store 전체 지도 열기",
      exact: true,
    })
    .click();
  await expect(page.getByRole("region", { name: "장소 지도" })).toBeVisible();
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

for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
  test(`responsive discovery and map controls at ${width}px`, async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(isMobile, "Run each viewport once with an explicit size");
    await page.setViewportSize({ width, height: 900 });
    const mobile = width < 1024;
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      mobile ? "취향으로 찾는 테마지도" : "좋은 장소는",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (!mobile) {
      // Text can overlap the neighboring panel without overflowing the page.
      const overlapsPanel = await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
        const panel = document.getElementById("communities")!.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(heading);
        return [...range.getClientRects()].some((rect) => rect.right > panel.left);
      });
      expect(overlapsPanel).toBe(false);

      const panel = page.locator("#communities");
      const footer = page.locator("footer");
      const [panelBox, footerBox] = await Promise.all([
        panel.boundingBox(),
        footer.boundingBox(),
      ]);
      expect(panelBox!.y + panelBox!.height).toBeLessThan(footerBox!.y);
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(900);
    }
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`) });
    if (mobile) {
      const rows = page.locator("[data-mobile-story-home] article");
      expect(await rows.count()).toBeGreaterThan(0);
      await expect(rows.first().getByRole("button").first()).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(rows.first().locator("p").first()).toBeHidden();
    }
    await page.goto("/maps/tokyo-fashion");
    if (mobile) {
      await expect(
        page.getByRole("textbox", { name: "이 맵의 장소 검색" }),
      ).toBeHidden();
      await page.getByRole("button", { name: "장소 검색 열기" }).click();
    }
    const search = page.getByRole("textbox", { name: "이 맵의 장소 검색" });
    await expect(search).toBeVisible();
    if (mobile) {
      const searchBox = (await search.boundingBox())!;
      expect(searchBox.width).toBeGreaterThan(width - 165);
      const mapBox = (await page
        .getByRole("region", { name: "장소 지도" })
        .boundingBox())!;
      expect(mapBox.height).toBeGreaterThanOrEqual(890);
      await page.locator(".mobile-map-filter-menu summary").click();
      await expect(
        page.getByRole("combobox", { name: "장소 지역" }),
      ).toBeVisible();
      await page.locator(".mobile-map-filter-menu summary").click();
      const carousel = page.getByRole("region", { name: "장소 미리보기" });
      await expect(carousel).toBeVisible();
      const cardBox = (await carousel.boundingBox())!;
      expect(900 - cardBox.y - cardBox.height).toBeCloseTo(10, 0);
      const trackBox = (await carousel
        .locator(".mobile-place-track")
        .boundingBox())!;
      const currentCard = (await carousel
        .locator(".mobile-place-slide")
        .first()
        .boundingBox())!;
      expect(currentCard.width).toBeCloseTo(trackBox.width, 0);
      const initialTitle = await carousel.getByRole("heading").innerText();
      await expect(
        carousel.getByRole("button", { name: "이전 장소", exact: true }),
      ).toBeDisabled();
      await carousel
        .getByRole("button", { name: "다음 장소", exact: true })
        .click();
      await expect(carousel.getByRole("heading")).not.toHaveText(initialTitle);
      await carousel
        .getByRole("button", { name: "이전 장소", exact: true })
        .click();
      await expect(carousel.getByRole("heading")).toHaveText(initialTitle);
      await expect(
        page.locator(".map-pin-votes, .map-marker-votes"),
      ).toHaveCount(0);
      await expect(
        page.locator(".map-pin-likes").first().locator("svg"),
      ).toBeVisible();
      await page.setViewportSize({ width, height: 700 });
      await expect
        .poll(async () => {
          const box = (await carousel.boundingBox())!;
          return Math.round(700 - box.y - box.height);
        })
        .toBe(10);
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("navigation", { name: "모바일 주요 메뉴" }),
      ).toBeHidden();
      const before = await carousel.getByRole("heading").innerText();
      await page
        .locator(".mobile-place-track")
        .evaluate((element) =>
          element.scrollTo({ left: element.clientWidth, behavior: "instant" }),
        );
      await expect(carousel.getByRole("heading")).not.toHaveText(before);
      const after = await carousel.getByRole("heading").innerText();
      await expect(
        page.getByRole("button", {
          name: `${after} 지도에서 선택`,
          exact: false,
        }),
      ).toHaveAttribute("data-selected", "true");
      await carousel
        .getByRole("button", { name: "상세 보기", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: `${after} 장소 상세` }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "모바일 주요 메뉴" }),
      ).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(
        carousel.getByRole("button", { name: "상세 보기", exact: true }),
      ).toBeFocused();
      await search.fill("no-matching-place");
      await expect(page.getByText("조건에 맞는 장소가 없어요.")).toBeVisible();
      await page
        .getByRole("button", { name: "검색 조건 초기화", exact: true })
        .click();
      await expect(carousel).toBeVisible();
    } else {
      await expect(
        page.getByRole("navigation", { name: "모바일 주요 메뉴" }),
      ).toBeHidden();
      await expect(
        page.getByRole("region", { name: "장소 목록" }),
      ).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`map-${width}.png`) });
    if (mobile) {
      await page.getByRole("link", { name: "홈으로 돌아가기" }).click();
      await expect(page).toHaveURL("/");
    }
  });
}

test("mobile discovery filter sheet restores focus and preserves conditions", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/discover");
  const trigger = page.getByRole("button", { name: "필터", exact: true });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "지도 필터" });
  await expect(sheet).toBeVisible();
  const sheetBox = (await sheet.boundingBox())!;
  expect(sheetBox.x).toBeGreaterThanOrEqual(0);
  expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await expect(
    page.getByRole("navigation", { name: "모바일 주요 메뉴" }),
  ).toBeHidden();
  await sheet.getByRole("combobox", { name: "정렬" }).selectOption("places");
  await sheet.getByRole("button", { name: /결과 .*개 보기/ }).click();
  await expect(trigger).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "장소 많은 순" }),
  ).toBeVisible();
  await trigger.click();
  await expect(sheet.getByRole("combobox", { name: "정렬" })).toHaveValue(
    "places",
  );
  await sheet.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(sheet.getByRole("combobox", { name: "정렬" })).toHaveValue(
    "popular",
  );
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("mobile enlarged content and carousel scrolling remain usable", async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  const carousel = page.getByRole("region", { name: "장소 미리보기" });
  await expect(carousel).toBeVisible();
  await page
    .locator(".mobile-place-track")
    .evaluate((element) =>
      element.scrollTo({ left: element.clientWidth * 2, behavior: "instant" }),
    );
  await expect(carousel.getByRole("heading")).toHaveText("Second Chapter");
  await page.getByRole("button", { name: "장소 검색 열기" }).click();
  await page.locator(".mobile-map-filter-menu summary").click();
  await page
    .getByRole("combobox", { name: "장소 정렬" })
    .selectOption("newest");
  await page.locator(".mobile-map-filter-menu summary").click();
  await expect(carousel.getByRole("heading")).toHaveText("Sunday Vintage");
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "장소 목록" })
      .getByRole("article")
      .first(),
  ).toContainText("Sunday Vintage");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-enlarged.png") });
});

test("mobile map load failure keeps list navigation available", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  let blockedMapChunk = false;
  await page.route("**/chunks/*.js", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    // Production minifies function names; this accessible label remains in
    // the lazy map renderer and lets us fail its real network request.
    if (body.includes("가상 장소 지도 미리보기")) {
      blockedMapChunk = true;
      await route.abort();
    } else await route.fulfill({ response });
  });
  await page.goto("/maps/tokyo-fashion");
  await expect(
    page.getByRole("button", { name: "목록으로 보기", exact: true }),
  ).toBeVisible();
  expect(blockedMapChunk).toBe(true);
  await page
    .getByRole("button", { name: "목록으로 보기", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "장소 목록" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archive Room", exact: true }),
  ).toBeVisible();
});
