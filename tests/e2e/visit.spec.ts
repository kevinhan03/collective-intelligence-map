import { test, expect } from "@playwright/test";
import { expandMobileDetail, openFirstMobilePlace } from "./mobile-sheet";

test("map omits the legacy area re-search control", async ({ page }) => {
  await page.goto("/maps/tokyo-fashion");
  await expect(
    page.getByRole("button", { name: "이 지역에서 다시 찾기", exact: true }),
  ).toHaveCount(0);
});

for (const failureCode of [1, 3]) {
  test(`location ${failureCode === 1 ? "denied" : "timeout"} preserves the previous sort`, async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript((failureCode) => {
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (
            _success: PositionCallback,
            error: PositionErrorCallback,
          ) =>
            error({
              code: failureCode,
              message: "failed",
            } as GeolocationPositionError),
        },
      });
    }, failureCode);
    await page.goto("/maps/tokyo-fashion");
    await expect(
      page.getByRole("alert").filter({ hasText: "위치를 확인하지 못했어요" }),
    ).toHaveCount(0);
    if (isMobile) {
      await page
        .getByRole("button", { name: "목록 보기", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "장소 정렬" })
        .selectOption("newest");
      await page
        .getByRole("combobox", { name: "장소 정렬" })
        .selectOption("distance");
      await expect(
        page.getByRole("combobox", { name: "장소 정렬" }),
      ).toHaveValue("newest");
    } else {
      await page
        .getByRole("button", { name: "최근 추가순", exact: true })
        .click();
      await page
        .getByRole("button", { name: "가까운 순", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "최근 추가순", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await expect(
      page.getByRole("alert").filter({ hasText: "위치를 확인하지 못했어요" }),
    ).toContainText("위치를 확인하지 못했어요");
  });
}

test("location success keeps distances in detail and preserves mobile search", async ({
  page,
  context,
  isMobile,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.66, longitude: 139.7 });
  await page.goto("/maps/tokyo-fashion");
  await page.getByRole("button", { name: "내 위치", exact: true }).click();
  if (isMobile) {
    await openFirstMobilePlace(page);
    await expect(
      page.locator('.mobile-place-slide[aria-hidden="false"]'),
    ).not.toContainText("직선거리");
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    const search = page.getByRole("combobox", {
      name: "이 맵의 장소 검색",
      exact: true,
    });
    await search.fill("Archive");
    await page.getByRole("button", { name: "지도 보기", exact: true }).click();
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await expect(search).toHaveValue("Archive");
  } else {
    await page.getByRole("button", { name: "가까운 순", exact: true }).click();
  }
  await expect(
    page
      .getByRole("region", { name: "장소 목록" })
      .getByRole("article")
      .first(),
  ).not.toContainText("직선거리");
  await page
    .getByRole("region", { name: "장소 목록" })
    .getByRole("article")
    .first()
    .getByRole("button")
    .first()
    .click();
  if (isMobile) await expandMobileDetail(page);
  await expect(page.locator(".place-detail-panel")).toContainText(
    "내 위치에서 직선거리",
  );
});

test("map sharing copies a map-only URL", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (url: string) => {
          document.documentElement.dataset.sharedUrl = url;
        },
      },
    });
  });
  await page.goto("/maps/tokyo-fashion");
  await page
    .getByRole("button", {
      name: "Tokyo Fashion Store 지도 정보 보기",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Tokyo Fashion Store 공유", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "링크를 복사했어요" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shared-url",
    /\/maps\/tokyo-fashion$/,
  );
});

test("place sharing copies the canonical deep link and opens without login", async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (url: string) => {
          document.documentElement.dataset.sharedUrl = url;
        },
      },
    });
  });
  await page.goto("/maps/tokyo-fashion");
  if (isMobile)
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await page
    .getByRole("region", { name: "장소 목록" })
    .getByRole("button", { name: "Archive Room", exact: true })
    .click();
  if (isMobile) await expandMobileDetail(page);
  await page
    .getByRole("button", { name: "Archive Room 공유", exact: true })
    .click();
  const url = await page.locator("html").getAttribute("data-shared-url");
  expect(url).toMatch(/\/maps\/tokyo-fashion\/places\/[0-9a-f-]{36}$/);
  await page.goto(url!);
  await expect(
    page.getByRole("heading", { name: "Archive Room", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "지도에서 상세·사진 보기" }).click();
  await expect(
    page.getByRole(isMobile ? "dialog" : "complementary", {
      name: "Archive Room 장소 상세",
    }),
  ).toBeVisible();
});

test("cancelling the native mobile share sheet is silent", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    });
  });
  await page.goto("/maps/tokyo-fashion");
  await page
    .getByRole("button", {
      name: "Tokyo Fashion Store 지도 정보 보기",
      exact: true,
    })
    .click();
  const share = page.getByRole("button", {
    name: "Tokyo Fashion Store 공유",
    exact: true,
  });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(
    page.getByText("공유하지 못했어요. 다시 시도해 주세요."),
  ).toHaveCount(0);
});

test("detail scroll hint follows overflow and disappears at the bottom", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: 520 });
  await page.goto("/maps/tokyo-fashion");
  if (isMobile)
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await page
    .getByRole("region", { name: "장소 목록" })
    .getByRole("article")
    .first()
    .getByRole("button")
    .first()
    .click();
  if (isMobile) await expandMobileDetail(page);
  const body = page.locator(".place-detail-scroll");
  const hint = page.locator(".place-detail-scroll-hint");
  await expect(body).toBeVisible();
  await expect(body).toHaveCSS("scrollbar-width", "none");
  if (isMobile) {
    // The compact mobile detail may initially fit; expanded records must also
    // update the hint when their content creates overflow.
    for (const summary of await page
      .locator(".participation-section summary")
      .all())
      await summary.click();
    await body.evaluate((element) => {
      element.scrollTop = 0;
    });
  }
  await expect(hint).toBeVisible();
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(hint).toHaveCount(0);
  await body.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(hint).toBeVisible();
});

test("discovery list scroll hint follows scrolling and filtered content", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "The left discovery panel scrolls internally on desktop.",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/maps/tokyo-fashion");
  const list = page.getByRole("region", { name: "장소 목록" });
  const hint = page.locator(".place-list-scroll-hint span");
  await expect(hint).toBeVisible();
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(hint).toHaveCount(0);
  await list.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(hint).toBeVisible();
  await page
    .getByRole("combobox", { name: "이 맵의 장소 검색" })
    .fill("Archive Room");
  await expect(list.getByRole("article")).toHaveCount(1);
  await expect(hint).toHaveCount(0);
});

test("mobile map actions fit inside the preview card and remain available in list view", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/maps/tokyo-fashion");
    await openFirstMobilePlace(page);
    const card = page.locator(".mobile-place-carousel");
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("button", { name: "목록 보기", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".mobile-propose-floating")).toBeVisible();
    await expect(card).not.toContainText("가까운 역");
    const bounds = await card.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const actions = await card
      .locator(".mobile-explorer-actions")
      .boundingBox();
    expect(actions!.y).toBeGreaterThan(bounds!.y);
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(
      bounds!.y + bounds!.height + 1,
    );
    await expect(
      card.getByRole("button", { name: "상세 보기", exact: true }),
    ).toHaveCount(0);
    await expect(
      card.getByRole("button", { name: "장소 상세 펼치기", exact: true }),
    ).toBeVisible();
    const saved = card.locator(".mobile-save-action");
    await expect(
      card.locator(".mobile-explorer-actions .mobile-save-action"),
    ).toHaveCount(0);
    await expect(saved).toBeVisible();
    expect((await saved.boundingBox())!.height).toBe(44);
    const switchBounds = (await card
      .locator(".visit-view-switch")
      .boundingBox())!;
    expect(switchBounds.x + switchBounds.width / 2).toBeCloseTo(width / 2, 0);
    const savedBounds = (await saved.boundingBox())!;
    const closeBounds = (await card
      .getByRole("button", { name: "장소 카드 닫기", exact: true })
      .boundingBox())!;
    expect(savedBounds.x + savedBounds.width).toBeLessThanOrEqual(
      closeBounds.x,
    );
    expect(Math.abs(savedBounds.y - closeBounds.y)).toBeLessThan(2);
    const menuBounds = (await page
      .getByRole("button", { name: "메뉴 열기", exact: true })
      .boundingBox())!;
    const proposalBounds = (await page
      .locator(".mobile-propose-floating")
      .boundingBox())!;
    expect(proposalBounds.x + proposalBounds.width / 2).toBe(
      menuBounds.x + menuBounds.width / 2,
    );
    expect(proposalBounds.y).toBeGreaterThan(menuBounds.y + menuBounds.height);
    await expect(page.locator(".mobile-propose-floating")).toHaveText("");
    await expect(
      page.getByRole("button", { name: "내 위치", exact: true }),
    ).toHaveCSS("background-color", "rgb(32, 39, 49)");
    const location = page.getByRole("button", { name: "내 위치", exact: true });
    await expect(location).toHaveText("");
    const locationBounds = (await location.boundingBox())!;
    expect(locationBounds.width).toBe(44);
    expect(locationBounds.height).toBe(44);
    await expect(location.locator("svg circle")).toHaveCount(1);
    if (width === 390)
      await page.screenshot({ path: "artifacts/mobile-map-actions.png" });
    await card.getByRole("button", { name: "목록 보기", exact: true }).click();
    const listSwitch = page.locator(".visit-view-switch:visible");
    await expect(listSwitch).toBeVisible();
    const listSwitchBounds = (await listSwitch.boundingBox())!;
    expect(listSwitchBounds.x + listSwitchBounds.width / 2).toBeCloseTo(
      width / 2,
      0,
    );
    expect(Math.abs(listSwitchBounds.y - switchBounds.y)).toBeLessThanOrEqual(
      3,
    );
    if (width === 390)
      await page.screenshot({
        path: "artifacts/mobile-centered-toggle-list.png",
      });
    await expect(page.locator(".mobile-propose-floating")).toBeVisible();
    await page.getByRole("button", { name: "지도 보기", exact: true }).click();
    await expect(card).toBeVisible();
    await card
      .getByRole("button", { name: "장소 카드 닫기", exact: true })
      .click();
    await expect(page.locator(".mobile-place-peek")).toBeVisible();
    const floatingSwitch = page.locator(
      ".mobile-closed-controls .visit-view-switch",
    );
    await expect(floatingSwitch).toBeVisible();
    const floatingBounds = (await floatingSwitch.boundingBox())!;
    expect(floatingBounds.x + floatingBounds.width / 2).toBeCloseTo(
      width / 2,
      0,
    );
    const peekBounds = (await page
      .locator(".mobile-place-peek")
      .boundingBox())!;
    expect(floatingBounds.y).toBeGreaterThanOrEqual(0);
    expect(floatingBounds.y + floatingBounds.height).toBeLessThanOrEqual(
      peekBounds.y,
    );
    if (width === 390)
      await page.screenshot({
        path: "artifacts/mobile-centered-toggle-closed.png",
      });
  }
});

test("mobile place summary expands to detail and collapses without losing selection", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const card = page.locator(".mobile-place-carousel");
  const name = await card.getByRole("heading").innerText();
  async function swipe(
    handle: import("@playwright/test").Locator,
    direction: number,
  ) {
    const b = (await handle.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      b.x + b.width / 2,
      b.y + b.height / 2 + direction * 65,
      { steps: 5 },
    );
    await page.mouse.up();
  }
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await expect(card).toHaveCSS("transform", "none");
  await page.screenshot({ path: "artifacts/place-sheet-summary.png" });
  await expect(
    card.getByRole("region", { name: "방문자 사진 미리보기" }),
  ).toHaveCount(0);
  await swipe(
    card.getByRole("button", { name: "장소 상세 펼치기", exact: true }),
    -1,
  );
  const detail = page.getByRole("dialog", { name: `${name} 장소 상세` });
  await expect(detail).toBeVisible();
  await expect(detail).toHaveCSS("transform", "none");
  await expect(detail.locator(".place-detail-topbar")).toHaveCount(0);
  await expect(detail.getByText("장소 상세", { exact: true })).toHaveCount(0);
  const titleBounds = (await detail
    .getByRole("heading", { name, exact: true })
    .boundingBox())!;
  const closeBounds = (await detail
    .getByRole("button", { name: "장소 상세 닫기", exact: true })
    .boundingBox())!;
  expect(
    Math.abs(
      titleBounds.y +
        titleBounds.height / 2 -
        closeBounds.y -
        closeBounds.height / 2,
    ),
  ).toBeLessThan(2);
  expect(closeBounds.x).toBeGreaterThan(titleBounds.x + titleBounds.width);
  await page.screenshot({ path: "artifacts/place-sheet-detail.png" });
  await expect(
    detail.getByRole("heading", { name, exact: true }),
  ).toBeVisible();
  await swipe(
    detail.getByRole("button", {
      name: "장소 카드 요약으로 접기",
      exact: true,
    }),
    1,
  );
  await expect(detail).toBeHidden();
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(name);
  await swipe(
    card.getByRole("button", { name: "장소 상세 펼치기", exact: true }),
    1,
  );
  await expect(card).toHaveCount(0);
  await page
    .getByRole("region", { name: "접힌 장소 카드" })
    .getByRole("button", { name: "장소 카드 펼치기", exact: true })
    .press("ArrowUp");
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await card
    .getByRole("button", { name: "장소 상세 펼치기", exact: true })
    .press("ArrowUp");
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(
    card.getByRole("button", { name: "장소 상세 펼치기", exact: true }),
  ).toBeFocused();
});

test("mobile sheet header drags, short drags settle, X stays closed and pin selection reopens", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const card = page.locator(".mobile-place-carousel");
  const header = card.locator(".place-sheet-title");
  const b = (await header.boundingBox())!;
  await page.mouse.move(b.x + 15, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 15, b.y + b.height / 2 - 16, { steps: 4 });
  await expect(card).toHaveAttribute("data-dragging", "true");
  await expect(card).not.toHaveCSS("transform", "none");
  await page.waitForTimeout(180);
  await page.mouse.up();
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await expect(card).toHaveCSS("transform", "none");
  await expect(card.getByText("위로 올려 장소 정보 보기")).toHaveCount(0);
  const name = await header.innerText();
  await card
    .getByRole("button", { name: "장소 상세 펼치기", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: `${name} 장소 상세` });
  await expect(detail).toBeVisible();
  await detail
    .getByRole("button", { name: "장소 상세 닫기", exact: true })
    .click();
  await expect(detail).toBeHidden();
  await expect(card).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(card).toHaveCount(0);
  await page
    .getByRole("button", { name: `${name} 지도에서 선택`, exact: false })
    .click();
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await expect(card.getByRole("heading")).toHaveText(name);
  await expect(card.getByText("위로 올려 장소 정보 보기")).toHaveCount(0);
  await card
    .getByRole("button", { name: "장소 카드 닫기", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await page
    .getByRole("region", { name: "장소 목록" })
    .getByRole("button", { name, exact: true })
    .click();
  await expandMobileDetail(page);
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(
    card.getByRole("button", { name: "장소 상세 펼치기", exact: true }),
  ).toBeFocused();
});

test("mobile view switch supports horizontal swipes without overriding taps", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  const swipe = async (from: "map" | "list", dx: number, dy = 0) => {
    const button = page.getByRole("button", {
      name: from === "map" ? "지도 보기" : "목록 보기",
      exact: true,
    });
    const bounds = (await button.boundingBox())!;
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    if (Math.abs(dx) > Math.abs(dy)) {
      await expect(button.locator("..")).toHaveAttribute(
        "data-view-dragging",
        "true",
      );
      expect(
        await page
          .locator(".community-explorer")
          .evaluate((element) =>
            (element as HTMLElement).style.getPropertyValue("--view-progress"),
          ),
      ).not.toBe("");
    }
    await page.mouse.up();
    expect(
      await page
        .locator(".community-explorer")
        .evaluate((element) =>
          (element as HTMLElement).style.getPropertyValue("--view-progress"),
        ),
    ).toBe("");
  };
  await swipe("map", 14);
  await expect(page.locator(".community-explorer")).toHaveAttribute(
    "data-mobile-view",
    "map",
  );
  await swipe("map", 35, 45);
  await expect(page.locator(".community-explorer")).toHaveAttribute(
    "data-mobile-view",
    "map",
  );
  await swipe("map", 48);
  await expect(page.locator(".community-explorer")).toHaveAttribute(
    "data-mobile-view",
    "list",
  );
  await swipe("list", -48);
  await expect(page.locator(".community-explorer")).toHaveAttribute(
    "data-mobile-view",
    "map",
  );
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(page.locator(".community-explorer")).toHaveAttribute(
    "data-mobile-view",
    "list",
  );
});

for (const reduced of [false, true]) {
  test(`mobile sheet motion respects reduced motion ${reduced}`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile);
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        if (this.classList.contains("mobile-place-dialog")) {
          const root = document.documentElement;
          root.dataset.sheetAnimationCount = String(
            Number(root.dataset.sheetAnimationCount ?? 0) + 1,
          );
          root.dataset.sheetAnimationDuration = String(
            typeof options === "number" ? options : options?.duration,
          );
        }
        return animate.call(this, frames, options);
      };
    });
    await page.goto("/maps/tokyo-fashion");
    await openFirstMobilePlace(page);
    const card = page.locator(".mobile-place-carousel");
    const name = await card.getByRole("heading").innerText();
    await card
      .getByRole("button", { name: "장소 상세 펼치기", exact: true })
      .click();
    const detail = page.getByRole("dialog", {
      name: `${name} 장소 상세`,
      exact: true,
    });
    await expect(detail).toBeVisible();
    // Record animation creation instead of sampling after Playwright waits;
    // a 280ms animation may have legitimately finished before that sample.
    const count = Number(
      (await page.locator("html").getAttribute("data-sheet-animation-count")) ??
        0,
    );
    if (reduced) expect(count).toBe(0);
    else {
      expect(count).toBeGreaterThan(0);
      await expect(page.locator("html")).toHaveAttribute(
        "data-sheet-animation-duration",
        "280",
      );
    }
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  });
}

test("mobile place cards swipe horizontally using the header and summary", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const card = page.locator(".mobile-place-carousel");
  const title = card.getByRole("heading");
  const initial = await title.innerText();
  const touch = await page.context().newCDPSession(page);
  const swipe = async (
    target: import("@playwright/test").Locator,
    dx: number,
    dy = 0,
  ) => {
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
    const b = (await target.boundingBox())!;
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 8; step++) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * step) / 8, y: y + (dy * step) / 8 }],
      });
    }
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  await swipe(title, 70);
  await expect(title).toHaveText(initial);
  await swipe(title, -18);
  await expect(title).toHaveText(initial);
  await swipe(title, -80);
  await expect(title).not.toHaveText(initial);
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await swipe(card.locator(".mobile-place-meta > span"), 80);
  await expect(title).toHaveText(initial);
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  const body = card
    .locator(
      '.mobile-place-slide[aria-hidden="false"] .mobile-place-summary > p',
    )
    .first();
  await swipe(body, -80);
  await expect(title).not.toHaveText(initial);
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  await swipe(body, 80);
  await expect(title).toHaveText(initial);
  await swipe(body, 0, -65);
  await expect(title).toHaveText(initial);
  await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  for (
    let i = 0;
    i < 12 &&
    (await card
      .getByRole("button", { name: "다음 장소", exact: true })
      .isEnabled());
    i++
  ) {
    await card.getByRole("button", { name: "다음 장소", exact: true }).click();
  }
  const last = await title.innerText();
  await swipe(title, -80);
  await expect(title).toHaveText(last);
  await expect(
    card.getByRole("button", { name: "다음 장소", exact: true }),
  ).toBeDisabled();
});

for (const width of [320, 390, 768]) {
  test(`detail map action in more preserves list context at ${width}px`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/maps/tokyo-fashion");
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    const sort = page.getByRole("combobox", { name: "장소 정렬", exact: true });
    await sort.selectOption("newest");
    const title = page.locator(".mobile-list-title").last();
    const name = await title.innerText();
    await title.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await title.click();
    await expandMobileDetail(page);
    const detail = page.locator(".mobile-place-dialog");
    await expect(detail).toBeVisible();
    const action = detail.getByRole("button", {
      name: "지도에서 보기",
      exact: true,
    });
    await expect
      .poll(() =>
        detail.evaluate(
          (element) =>
            element
              .getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
      )
      .toBe(0);
    const share = detail.getByRole("button", {
      name: `${name} 공유`,
      exact: true,
    });
    await expect(share).toBeVisible();
    const more = detail
      .locator(".participation-section")
      .filter({ has: page.locator("summary", { hasText: "더 보기" }) });
    await expect(more).not.toHaveAttribute("open");
    await more.locator("summary").click();
    await expect(action).toBeVisible();
    await action.click();
    await expect(detail).toHaveCount(0);
    await expect(page.locator(".community-explorer")).toHaveAttribute(
      "data-mobile-view",
      "map",
    );
    await expect(
      page.locator(".mobile-place-carousel").getByRole("heading"),
    ).toHaveText(name);
    await expect(
      page.locator('.map-pin[data-selected="true"]'),
    ).toHaveAttribute("aria-label", new RegExp(name));
    await expect(
      page.locator(".mobile-place-carousel .place-sheet-handle"),
    ).toBeFocused();
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await expect(sort).toHaveValue("newest");
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeCloseTo(before, 0);
    // Searching remains scoped when returning from detail to the map.
    const input = page.getByRole("combobox", {
      name: "이 맵의 장소 검색",
      exact: true,
    });
    await input.fill("Archive");
    await page
      .locator(".mobile-list-title")
      .getByText("Archive Room", { exact: true })
      .click();
    await expandMobileDetail(page);
    await page
      .locator(".mobile-place-dialog summary")
      .filter({ hasText: "더 보기" })
      .click();
    await page
      .locator(".mobile-place-dialog")
      .getByRole("button", { name: "지도에서 보기", exact: true })
      .click();
    await expect(page.locator(".mobile-place-dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await expect(input).toHaveValue("Archive");
  });
}

test("mobile map opens on every place in a swipeable list instead of one selected place", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  const overview = page.locator(".mobile-place-overview");
  await expect(overview).toHaveAttribute("data-sheet-stage", "collapsed");
  await expect(page.locator(".mobile-place-carousel")).toHaveCount(0);
  await expect(page.locator('.map-pin[data-selected="true"]')).toHaveCount(0);
  await expect(overview.locator(".mobile-list-place")).toHaveCount(0);
  const total = Number(
    (await overview.getByRole("heading").innerText()).match(/\d+/)![0],
  );
  await overview
    .getByRole("button", { name: "장소 목록 펼치기", exact: true })
    .click();
  await expect(overview).toHaveAttribute("data-sheet-stage", "summary");
  await expect(overview.locator(".mobile-list-place")).toHaveCount(total);
  await overview
    .getByRole("button", { name: "장소 목록 접기", exact: true })
    .click();
  await expect(overview).toHaveAttribute("data-sheet-stage", "collapsed");
  await overview
    .getByRole("button", { name: "장소 목록 펼치기", exact: true })
    .click();
  const first = overview.locator(".mobile-list-title-text").first();
  const name = await first.innerText();
  await first.click();
  const card = page.locator(".mobile-place-carousel");
  await expect(card.getByRole("heading")).toHaveText(name);
  await card
    .getByRole("button", { name: "장소 카드 닫기", exact: true })
    .click();
  await expect(page.locator(".mobile-place-peek")).toBeVisible();
  await expect(overview).toHaveCount(0);
  await expect(card).toHaveCount(0);
});
