import { test, expect } from "@playwright/test";

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
      await page.locator(".mobile-map-filter-menu summary").click();
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
      await page.getByRole("button", { name: "최신순", exact: true }).click();
      await page
        .getByRole("button", { name: "가까운 순", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "최신순", exact: true }),
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
    await expect(
      page.locator('.mobile-place-slide[aria-hidden="false"]'),
    ).not.toContainText("직선거리");
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    const search = page.getByRole("textbox", {
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
  await page
    .getByRole("button", { name: "Archive Room 공유", exact: true })
    .click();
  const url = await page.locator("html").getAttribute("data-shared-url");
  expect(url).toMatch(/\/maps\/tokyo-fashion\?place=[0-9a-f-]{36}$/);
  await page.goto(url!);
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
