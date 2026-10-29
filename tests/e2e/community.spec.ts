import { test, expect, type Page } from "@playwright/test";
import { openFirstMobilePlace, swipeMobilePlace } from "./mobile-sheet";
async function expandMobileDetail(page: Page) {
  const collapsed = page.getByRole("button", {
    name: "장소 카드 펼치기",
    exact: true,
  });
  if (await collapsed.isVisible()) await collapsed.click();
  await page
    .getByRole("button", { name: "장소 상세 펼치기", exact: true })
    .click();
}
test("desktop discovery keeps search, sorting and compact reactions beside the map", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/maps/tokyo-fashion");
  const list = page.getByRole("region", { name: "장소 목록", exact: true });
  const header = list.locator(".discovery-header");
  const search = header.getByRole("combobox", { name: "이 맵의 장소 검색" });
  await expect(search).toBeVisible();
  await expect(header.getByRole("group", { name: "장소 정렬" })).toBeVisible();
  const bounds = await page.locator(".explorer-layout").evaluate((layout) => {
    const list = layout
      .querySelector("#explorer-list")!
      .getBoundingClientRect();
    const map = layout.querySelector("#explorer-map")!.getBoundingClientRect();
    return {
      topDifference: Math.abs(list.top - map.top),
      gap: map.left - list.right,
    };
  });
  expect(bounds.topDifference).toBeLessThanOrEqual(1);
  expect(bounds.gap).toBeGreaterThan(0);
  expect(bounds.gap).toBeLessThanOrEqual(20);
  const capsule = list.locator(".vote-capsule").first();
  await expect(capsule.getByRole("button")).toHaveCount(2);
  const capsuleBox = (await capsule.boundingBox())!;
  expect(capsuleBox.width).toBeLessThanOrEqual(100);
  expect(capsuleBox.height).toBeLessThanOrEqual(30);
  await header.getByLabel("발견 목록 필터", { exact: true }).click();
  await expect(
    header.getByRole("combobox", { name: "장소 지역", exact: true }),
  ).toBeVisible();
  await header
    .getByRole("combobox", { name: "장소 지역", exact: true })
    .press("Escape");
  await expect(
    header.getByRole("combobox", { name: "장소 지역", exact: true }),
  ).toBeHidden();
  await search.fill("no-matching-place");
  await expect(
    list.getByText("조건에 맞는 장소가 없어요.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-pin")).toHaveCount(0);
  await header.getByRole("button", { name: "검색·역 필터 초기화" }).click();
  await expect(page.locator(".map-pin")).toHaveCount(6);
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(search).toBeInViewport();
});
test("mobile logo stays visible after direct map entry and returning home", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/");
  const logo = page.getByRole("link", { name: "Ting map 홈", exact: true });
  await expect(logo).toBeVisible();
  await page
    .getByRole("link", { name: "도쿄 패션 스토어 지도 열기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/maps\/tokyo-fashion/);
  await expect(logo).toBeHidden();
  await page.goBack();
  await expect(logo).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "지도 검색", exact: true }),
  ).toBeVisible();
});
test("mobile home exposes search above categories and submits to URL results", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const search = page.getByRole("searchbox", {
    name: "지도 검색",
    exact: true,
  });
  await expect(search).toBeInViewport();
  const input = await search.boundingBox(),
    categories = await page
      .getByRole("navigation", { name: "지도 카테고리" })
      .boundingBox();
  expect(input!.y + input!.height).toBeLessThan(categories!.y);
  await search.fill("Tokyo");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/discover\?q=Tokyo/);
  await expect(
    page.locator("[data-map-catalog=discover] [data-catalog-card]"),
  ).toHaveCount(1);
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
    page.getByRole("heading", { name: "도쿄 패션 스토어", exact: true }),
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
  test(`home footer follows content and is reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "로그인", exact: true }),
    ).toBeVisible();
    const footer = page.locator("footer");
    const [panelBox, footerBox] = await Promise.all([
      page.locator("[data-map-catalog]").boundingBox(),
      footer.boundingBox(),
    ]);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(footerBox!.y);
    await footer.scrollIntoViewIfNeeded();
    await expect(
      footer.getByRole("link", { name: "이용약관" }),
    ).toBeInViewport();
    await expect(
      footer.getByRole("link", { name: "개인정보 처리방침" }),
    ).toBeInViewport();
  });
}

test("mobile map search is optional and closing restores focus", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  const search = page.getByRole("combobox", { name: "이 맵의 장소 검색" });
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
    "취향으로 찾는 테마 지도",
  );
  await page
    .getByRole("link", { name: "도쿄 패션 스토어 지도 열기", exact: true })
    .click();
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
    .getByRole("combobox", { name: "이 맵의 장소 검색" })
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
    await expandMobileDetail(page);
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
  await expect(
    page.locator(".place-detail-panel .place-introductions"),
  ).toBeVisible();
  if (!isMobile)
    await expect(
      page.getByRole("heading", { name: "방문자 사진", exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "사진 추가", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "이 지도에 어울려요 0", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  if (isMobile)
    await page.getByRole("button", { name: "장소 검색 열기" }).click();
  await page
    .getByRole("combobox", { name: "이 맵의 장소 검색" })
    .fill("not-a-place");
  if (isMobile) {
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  }
  await expect(
    page.getByRole("status").filter({ hasText: "조건에 맞는 장소가 없어요." }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "이 맵의 장소 검색" }).fill("");
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
    "장소 제안",
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

test("mobile catalog filters and recovers from empty results", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/discover?q=no-matching-theme");
  await expect(
    page.getByRole("heading", { name: "조건에 맞는 지도가 없어요." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "검색어 지우기", exact: true })
    .click();
  await expect(page.locator("[data-catalog-card]")).toHaveCount(1);
  await page.getByRole("link", { name: "패션·쇼핑", exact: true }).click();
  await expect(page).toHaveURL(/category=fashion/);
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
  const list = page.locator("#explorer-list");
  const map = page.getByRole("region", { name: "장소 지도" });
  await expect(map).toBeVisible();
  await expect(list).toBeHidden();
  const mapBox = await map.boundingBox();
  const viewport = page.viewportSize();
  expect(mapBox?.height).toBeGreaterThan((viewport?.height ?? 0) * 0.5);
  await expect(
    page.getByText(
      "도쿄 곳곳에 있는 패션 매장들을 모아둔 지도입니다. 잘 알려진 유명 매장부터 숨겨진 로컬 숍까지, 도쿄에서 쇼핑할 만한 곳들을 함께 찾아보고 공유해 보세요.",
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
  await expect(
    page.locator(".mobile-place-carousel").getByRole("heading", { level: 2 }),
  ).toHaveText("Second Chapter");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expandMobileDetail(page);
  const detail = page.getByRole("dialog", { name: "Second Chapter 장소 상세" });
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Second Chapter 저장", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(preview).toBeVisible();
  await expect(
    page.getByRole("button", { name: "장소 상세 펼치기", exact: true }),
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
    .getByRole("link", { name: "도쿄 패션 스토어 지도 열기", exact: true })
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
      "취향으로 찾는 테마 지도",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.locator("[data-map-catalog=home] [data-catalog-card]"),
    ).toHaveCount(1);
    await expect(page.locator("[data-map-catalog=home] details")).toHaveCount(
      0,
    );
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(
      footer.getByRole("link", { name: "이용약관" }),
    ).toBeInViewport();
    await page.goto("/maps/tokyo-fashion");
    if (mobile) {
      await expect(
        page.getByRole("combobox", { name: "이 맵의 장소 검색" }),
      ).toBeHidden();
      await page.getByRole("button", { name: "장소 검색 열기" }).click();
    }
    const search = page.getByRole("combobox", { name: "이 맵의 장소 검색" });
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
      await openFirstMobilePlace(page);
      const carousel = page.getByRole("region", { name: "장소 미리보기" });
      await expect(carousel).toBeVisible();
      const cardBox = (await carousel.boundingBox())!;
      expect(900 - cardBox.y - cardBox.height).toBeCloseTo(10, 0);
      await expect(carousel).toHaveAttribute("data-sheet-stage", "summary");
      const trackBox = (await carousel
        .locator(".mobile-place-track")
        .boundingBox())!;
      const currentCard = (await carousel
        .locator(".mobile-place-slide")
        .first()
        .boundingBox())!;
      expect(currentCard.width).toBeCloseTo(trackBox.width, 0);
      const initialTitle = await carousel
        .getByRole("heading", { level: 2 })
        .innerText();
      await expect(
        carousel.getByRole("button", { name: "이전 장소", exact: true }),
      ).toBeDisabled();
      await carousel
        .getByRole("button", { name: "다음 장소", exact: true })
        .click();
      await expect(carousel.getByRole("heading", { level: 2 })).not.toHaveText(
        initialTitle,
      );
      await carousel
        .getByRole("button", { name: "이전 장소", exact: true })
        .click();
      await expect(carousel.getByRole("heading", { level: 2 })).toHaveText(
        initialTitle,
      );
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
      const before = await carousel
        .getByRole("heading", { level: 2 })
        .innerText();
      await swipeMobilePlace(page, "next");
      await expect(carousel.getByRole("heading", { level: 2 })).not.toHaveText(
        before,
      );
      const after = await carousel
        .getByRole("heading", { level: 2 })
        .innerText();
      await expect(
        page.getByRole("button", {
          name: `${after} 지도에서 선택`,
          exact: false,
        }),
      ).toHaveAttribute("data-selected", "true");
      await expandMobileDetail(page);
      await expect(
        page.getByRole("dialog", { name: `${after} 장소 상세` }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "모바일 주요 메뉴" }),
      ).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "장소 상세 펼치기", exact: true }),
      ).toBeFocused();
      await search.fill("no-matching-place");
      await expect(
        page
          .locator(".mobile-map-empty")
          .getByText("조건에 맞는 장소가 없어요."),
      ).toBeVisible();
      await page
        .locator(".mobile-map-empty")
        .getByRole("button", { name: "검색 조건 초기화", exact: true })
        .click();
      await expect(page.locator(".mobile-place-overview")).toBeVisible();
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

test("mobile discovery keeps search and category without obsolete filters", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto(
    "/discover?category=fashion&theme=버거&region=서울&sort=saved",
  );
  await expect(
    page.getByRole("button", { name: "필터", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("link", { name: "도쿄 패션 스토어 지도 열기", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "정렬", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "저장순 조건 해제", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "지도 검색", exact: true })
    .fill("no-matching-theme");
  await page
    .getByRole("button", { name: "지도 검색 결과 보기", exact: true })
    .click();
  await expect(page).not.toHaveURL(/region=|theme=|sort=/);
  await expect(
    page.getByRole("heading", { name: "조건에 맞는 지도가 없어요." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "검색어 지우기", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "도쿄 패션 스토어 지도 열기", exact: true }),
  ).toBeVisible();
});

test("mobile enlarged content and carousel swiping remain usable", async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const carousel = page.getByRole("region", { name: "장소 미리보기" });
  await expect(carousel).toBeVisible();
  await expect(carousel).toHaveAttribute("data-sheet-stage", "summary");
  await swipeMobilePlace(page, "next");
  await expect(carousel.getByRole("heading", { level: 2 })).toHaveText(
    "Studio 03",
  );
  await swipeMobilePlace(page, "next");
  await expect(carousel.getByRole("heading", { level: 2 })).toHaveText(
    "Second Chapter",
  );
  await page.getByRole("button", { name: "장소 검색 열기" }).click();
  await page.locator(".mobile-map-filter-menu summary").click();
  await page
    .getByRole("combobox", { name: "장소 정렬" })
    .selectOption("newest");
  await page.locator(".mobile-map-filter-menu summary").click();
  await expect(
    page.locator(".mobile-place-overview .mobile-list-title-text").first(),
  ).toHaveText("Sunday Vintage");
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

test("place detail survives a malformed tag response", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  // Another endpoint's payload (or an error body served with 200) must not
  // crash the detail sheet; the tag section reports its own failure instead.
  await page.route("**/api/map-places/*/tags", (route) =>
    route.fulfill({ json: { comments: [], checks: [] } }),
  );
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const name = await page
    .locator(".mobile-place-carousel")
    .getByRole("heading", { level: 2 })
    .innerText();
  await expandMobileDetail(page);
  const detail = page.getByRole("dialog", { name: `${name} 장소 상세` });
  await expect(detail).toBeVisible();
  await expect(
    detail
      .getByRole("alert")
      .filter({ hasText: "장소 태그를 불러오지 못했습니다." }),
  ).toBeVisible();
  await expect(detail.locator(".place-sheet-title")).toHaveText(name);
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

for (const width of [320, 390, 768]) {
  test(`catalog cards keep text and reactions inside their bounds at ${width}px`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const card = page.locator("[data-catalog-card]").first();
    await expect(card).toBeVisible();
    const boxes = await card.evaluate((e) => ({
      card: e.getBoundingClientRect().toJSON(),
      title: e.querySelector("h3")!.getBoundingClientRect().toJSON(),
      buttons: [...e.querySelectorAll("button")].map((b) =>
        b.getBoundingClientRect().toJSON(),
      ),
    }));
    expect(boxes.title.right).toBeLessThanOrEqual(boxes.card.right);
    for (const box of boxes.buttons) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.right).toBeLessThanOrEqual(boxes.card.right);
    }
    await expect(card.locator("button[aria-expanded]")).toHaveCount(0);
  });
}

for (const width of [320, 390, 768]) {
  test(`mobile list shows brand header without covering map controls at ${width}px`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/maps/tokyo-fashion");
    const logo = page.getByRole("link", { name: "Ting map 홈", exact: true });
    await expect(logo).toBeHidden();
    for (let i = 0; i < 2; i++) {
      await page
        .getByRole("button", { name: "목록 보기", exact: true })
        .click();
      await expect(logo).toBeVisible();
      await expect(logo).toContainText("Ting");
      const brand = (await page.locator(".glass-header").boundingBox())!;
      const hero = (await page.locator(".map-hero").boundingBox())!;
      expect(hero.y).toBeGreaterThanOrEqual(brand.y + brand.height);
      await page.getByRole("button", { name: "장소 검색 열기" }).click();
      await expect(
        page.getByRole("combobox", { name: "이 맵의 장소 검색", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "지도 보기", exact: true })
        .click();
      await expect(logo).toBeHidden();
    }
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await logo.click();
    await expect(page).toHaveURL("/");
    await expect(logo).toBeVisible();
  });
}

test("mobile place opens its summary and dismisses to a bottom sheet edge", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const card = page.getByRole("region", { name: "장소 미리보기" });
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await expect(
    card.locator(
      '.mobile-place-slide[aria-hidden="false"] .mobile-place-summary',
    ),
  ).toBeVisible();
  const firstName = await card.getByRole("heading", { level: 2 }).innerText();
  await expect(
    card.getByRole("button", { name: "이전 장소", exact: true }),
  ).toBeDisabled();
  await card.getByRole("button", { name: "다음 장소", exact: true }).click();
  await expect(card.getByRole("heading", { level: 2 })).not.toHaveText(
    firstName,
  );
  const nextName = await card.getByRole("heading", { level: 2 }).innerText();
  await card
    .getByRole("button", { name: "장소 카드 닫기", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await expect(page.locator(".mobile-result-count")).toHaveCount(0);
  const peek = page.getByRole("region", { name: "접힌 장소 카드" });
  await expect(peek).toBeVisible();
  const box = (await peek.boundingBox())!;
  expect(box.width).toBeGreaterThan(page.viewportSize()!.width - 30);
  expect(box.height).toBeLessThanOrEqual(60);
  expect(box.y + box.height).toBeCloseTo(page.viewportSize()!.height, 0);
  await expect(
    page.getByRole("button", { name: "목록 보기", exact: true }),
  ).toBeVisible();
  const handle = peek.getByRole("button", {
    name: "장소 카드 펼치기",
    exact: true,
  });
  await expect(handle).toBeFocused();
  await handle.press("ArrowUp");
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(nextName);
  await card.getByRole("button", { name: "이전 장소", exact: true }).click();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(firstName);
  await card
    .getByRole("button", { name: "장소 상세 펼치기", exact: true })
    .press("ArrowDown");
  await expect(peek).toBeVisible();
  await handle.click();
  await card
    .getByRole("button", { name: "장소 상세 펼치기", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: `${firstName} 장소 상세` });
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await page
    .getByRole("button", { name: "Second Chapter", exact: true })
    .click();
  await expect(page.locator(".community-explorer")).toHaveAttribute(
    "data-mobile-view",
    "map",
  );
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(
    "Second Chapter",
  );
});

test("conflicting catalog conditions remain visible and can be removed independently", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Mobile discovery now uses search and category only");
  await page.goto(
    "/discover?category=food&theme=" + encodeURIComponent("빈티지"),
  );
  await expect(
    page.getByRole("heading", {
      name: "조건에 맞는 지도가 없어요.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "세부 테마", exact: true }),
  ).toHaveValue("빈티지");
  await page
    .getByRole("button", { name: "음식·카페 조건 해제", exact: true })
    .click();
  await expect(
    page.locator('[data-map-catalog="discover"] [data-catalog-card]'),
  ).toHaveCount(1);
});

test("desktop catalog combines category and query while retaining clear images and light titles", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile);
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/");
  await page.getByRole("link", { name: "패션·쇼핑", exact: true }).click();
  await expect(page).toHaveURL(/category=fashion/);
  const search = page.getByRole("searchbox", {
    name: "지도 검색",
    exact: true,
  });
  await search.fill("no-such-map");
  await search.press("Enter");
  await expect(
    page.getByRole("heading", { name: "조건에 맞는 지도가 없어요." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "검색어 지우기", exact: true })
    .click();
  const card = page.locator("[data-catalog-card]").first();
  await expect(card.locator("h3")).toHaveCSS("font-weight", "500");
  await expect(card.locator("img")).toHaveCSS("filter", "none");
  await expect(
    page.getByRole("link", { name: "패션·쇼핑", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
