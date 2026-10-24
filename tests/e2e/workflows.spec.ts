import { test, expect, type Page } from "@playwright/test";
import { build } from "vite";
import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
test("recommended collection keeps all pins and preserves list selection", async ({
  page,
}, testInfo) => {
  await page.route("**/api/places/*/photos", (route) =>
    route.fulfill({ json: { photos: [], nextCursor: null } }),
  );
  await page.route("**/api/map-places/*/comments*", (route) =>
    route.fulfill({ json: { comments: [] } }),
  );
  await page.route("**/api/map-places/*/checks", (route) =>
    route.fulfill({ json: { checks: [], summary: {} } }),
  );
  await page.route("**/api/places/*/stations", (route) =>
    route.fulfill({ json: { stations: [], status: "unsupported" } }),
  );
  const calls: unknown[] = [];
  await page.route("**/api/community", (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await open(page, "recommendations");
  await expect(
    page.getByRole("heading", { name: "내가 추천한 장소", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recommendations-count")).toContainText("503곳");
  await page
    .getByRole("button", { name: "추천 장소 1 저장", exact: true })
    .click();
  expect(calls).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "추천 장소 1 저장 해제", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "추천 장소 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "지도", exact: true }).click();
  await expect(
    page
      .locator("#recommendations-map")
      .getByRole("button", { name: /테스트 핀$/ }),
  ).toHaveCount(503);
  await page
    .getByRole("button", { name: "추천 장소 503 테스트 핀", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "추천 장소 503", exact: true }),
  ).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await expect(page.locator("#recommendations-map")).toHaveClass(
      /has-detail/,
    );
    await expect(
      page.locator("#recommendations-map > .place-detail-panel"),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "장소 상세 닫기", exact: true })
    .click();
  await page.getByRole("button", { name: "목록", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "추천 장소 503", exact: true }),
  ).toHaveCount(1);
  await page.getByLabel("추천 장소 검색").fill("추천 장소 503");
  await expect(page.locator(".recommendations-count")).toContainText("1곳");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 390 : 1440,
    height: 900,
  });
  await page.screenshot({
    path: `test-results/recommendations-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("profile editor saves input and keeps partial-save feedback", async ({
  page,
}, testInfo) => {
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/community", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  let fail = true;
  await page.route("**/api/creator/maps", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      status: fail ? 500 : 200,
      json: fail ? { error: "연결 오류" } : { ok: true },
    });
  });
  await open(page, "profile-editor");
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  if (testInfo.project.name === "desktop") {
    const preview = page.locator(".profile-desktop-preview");
    await expect(
      preview.getByRole("link", { name: "내가 추천한 장소", exact: true }),
    ).toHaveAttribute("href", "/u/creator/recommendations");
    await expect(
      preview.locator(".profile-map-grid > a").first(),
    ).toHaveAttribute("aria-label", "내가 추천한 장소");
    await expect(
      preview.getByRole("link", { name: "첫 지도 만들기" }),
    ).toHaveAttribute("href", "/studio");
    await expect(
      preview.getByText("공개 장소 6곳 · 목록과 지도로 보기"),
    ).toBeVisible();
  } else {
    await expect(page.locator(".profile-mobile-preview")).toHaveCount(0);
  }
  await page.getByLabel("표시 이름", { exact: true }).fill("나의 취향");
  await page.getByLabel("사용자 이름", { exact: false }).fill("new_creator");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByRole("status")).toContainText(
    "사용자 이름·소개는 저장됐습니다",
  );
  await expect(page.getByLabel("표시 이름", { exact: true })).toHaveValue(
    "나의 취향",
  );
  await expect(
    page.getByRole("link", { name: "공개 프로필 보기", exact: true }),
  ).toHaveAttribute("href", "/u/new_creator");
  fail = false;
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByRole("status")).toHaveText("프로필을 저장했습니다.");
  expect(calls.filter((c) => c.action === "profile")).toHaveLength(4);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: `test-results/profile-editor-${testInfo.project.name}.png`,
    fullPage: true,
  });
  if (testInfo.project.name === "desktop") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.locator(".profile-desktop-preview .profile-card-gradient").first(),
    ).toBeVisible();
    expect(
      await page
        .locator(".profile-desktop-preview .profile-card-gradient")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
  }
});
test("profile overview keeps maps visible and moves editing behind one action", async ({
  page,
}, testInfo) => {
  await open(page, "profile-overview");
  await expect(
    page.getByRole("heading", { name: "프로필", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "프로필 편집", exact: true }),
  ).toHaveAttribute("href", "/settings/profile?edit=1");
  await expect(
    page.getByRole("link", { name: "내가 추천한 장소", exact: true }),
  ).toHaveAttribute("href", "/u/creator/recommendations");
  await expect(page.locator(".profile-mobile-preview")).toHaveCount(0);
  await expect(page.getByLabel("표시 이름", { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".profile-settings-overview .profile-identity img"),
  ).toHaveCount(0);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const actions = page.locator(".profile-owner-actions");
    const share = await actions
      .getByRole("button", { name: "Kevin 공유" })
      .boundingBox();
    const edit = await actions.locator("a.profile-action > span").boundingBox();
    expect(share).not.toBeNull();
    expect(edit).not.toBeNull();
    expect(Math.abs(share!.width - edit!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(share!.height - edit!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(share!.y - edit!.y)).toBeLessThanOrEqual(1);
    expect(edit!.x).toBeGreaterThan(share!.x + share!.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 390 : 1440,
    height: 900,
  });
  await page.screenshot({
    path: `test-results/profile-overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await open(page, "profile-overview-maps");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "첫 지도 만들기" })).toHaveCount(
    0,
  );
  const cards = page.locator(".profile-map-grid > a");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("aria-label", "내가 추천한 장소");
  await expect(cards.nth(1)).toHaveAttribute("href", "/studio?map=owner-map-0");
  const first = await cards.nth(1).boundingBox();
  const second = await cards.nth(2).boundingBox();
  expect(first!.y).toBe(second!.y);
  expect(second!.x).toBeGreaterThan(first!.x + first!.width);
  await page.screenshot({
    path: `test-results/profile-overview-maps-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("public profile presents map links without cover placeholders", async ({
  page,
}, testInfo) => {
  await page.route("**/maps/test-map/cover", (route) =>
    route.fulfill({
      contentType: "image/webp",
      body: readFileSync(resolve("public/glass-neighborhood.webp")),
    }),
  );
  await open(page, "profile-public");
  await expect(page.locator(".profile-identity img")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Kevin", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /테스트 지도/ })).toHaveAttribute(
    "href",
    "/maps/test-map",
  );
  await expect(page.getByText("대표 지도", { exact: true })).toHaveCount(1);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `test-results/profile-public-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
let bundle = "";
let css = "";
test.beforeAll(async () => {
  const chunks = resolve(".next-e2e/static/chunks");
  css = readdirSync(chunks)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(resolve(chunks, name), "utf8"))
    .join("\n");
  const primitives = resolve("tests/fixtures/primitives.tsx");
  const result = await build({
    configFile: false,
    resolve: {
      alias: [
        {
          find: "next/navigation",
          replacement: resolve("tests/fixtures/navigation.ts"),
        },
        { find: "next/link", replacement: "workflow-link" },
        { find: "next/image", replacement: "workflow-image" },
        { find: "@/components/map/map-canvas", replacement: primitives },
        {
          find: "@",
          replacement: resolve("src"),
        },
      ],
    },
    plugins: [
      {
        name: "workflow-mocks",
        resolveId(id) {
          if (id.startsWith("workflow-")) return id;
        },
        load(id) {
          if (id === "workflow-link")
            return `export { Link as default } from ${JSON.stringify(primitives)}`;
          if (id === "workflow-image")
            return `export { Image as default } from ${JSON.stringify(primitives)}`;
        },
      },
    ],
    // Keep React diagnostics enabled so reconciliation warnings fail regressions.
    define: { "process.env.NODE_ENV": '"development"' },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve("tests/fixtures/workflows.tsx"),
        formats: ["iife"],
        name: "WorkflowTests",
      },
    },
    logLevel: "error",
  });
  const output = Array.isArray(result)
    ? result[0].output
    : "output" in result
      ? result.output
      : [];
  css += output
    .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
    .map((item) => (item.type === "asset" ? String(item.source) : ""))
    .join("\n");
  bundle = output
    .filter((item) => item.type === "chunk")
    .map((item) => (item.type === "chunk" ? item.code : ""))
    .join("\n");
});
async function open(page: Page, fixture = "proposal") {
  await page.route("**/workflow-fixture*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html lang="ko" class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root" class="${fixture.startsWith("profile-") || fixture === "recommendations" ? "" : `page-wrap ${fixture === "admin" ? "max-w-4xl" : "max-w-2xl"}`}"></div></body></html>`,
    }),
  );
  await page.goto(`/workflow-fixture?fixture=${fixture}`);
  await page.addScriptTag({ content: bundle });
}

test("visitors can add introductions to someone else's place and edit only their own", async ({
  page,
}) => {
  const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const original = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    body: "먼저 다녀간 사람의 소개입니다.",
    author_id: "other",
    handle: "other",
    created_at: "2026-10-15",
  };
  let entries = [original];
  await page.route("**/api/map-places/*/introductions", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.id)
        entries = entries.map((entry) =>
          entry.id === input.id ? { ...entry, body: input.body } : entry,
        );
      else
        entries.push({
          ...original,
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          body: input.body,
          author_id: user,
          handle: "visitor",
        });
      return route.fulfill({ json: { id: input.id ?? entries.at(-1)!.id } });
    }
    return route.fulfill({ json: { introductions: entries } });
  });
  await page.route("**/api/map-places/*/comments*", (route) =>
    route.fulfill({ json: { comments: [] } }),
  );
  await page.route("**/api/map-places/*/checks", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/api/places/*/photos*", (route) =>
    route.fulfill({ json: { photos: [], nextCursor: null } }),
  );
  await page.route("**/api/places/*/stations", (route) =>
    route.fulfill({ json: { stations: [], status: "unsupported" } }),
  );
  await page.route("**/api/community", (route) => {
    const input = route.request().postDataJSON();
    if (input.action === "delete_comment")
      entries = entries.filter((entry) => entry.id !== input.id);
    return route.fulfill({ json: {} });
  });
  await open(page, "place-introductions");
  const section = page.getByRole("region", { name: "장소 소개", exact: true });
  await expect(section.getByText(original.body)).toBeVisible();
  await expect(
    section.getByRole("button", { name: "수정", exact: true }),
  ).toHaveCount(0);
  await section.getByRole("button", { name: "장소 소개 메뉴" }).click();
  await page
    .getByRole("menuitem", { name: "소개 추가하기", exact: true })
    .click();
  await section
    .getByLabel("장소 소개 추가")
    .fill("등록자가 아닌 방문자의 새 소개입니다.");
  await section.getByRole("button", { name: "소개 저장" }).click();
  await expect(
    section.getByText("등록자가 아닌 방문자의 새 소개입니다."),
  ).toBeVisible();
  await expect(section.getByText(original.body)).toBeVisible();
  await section.getByRole("button", { name: "수정", exact: true }).click();
  await section.getByLabel("내 소개 수정").fill("내 소개만 수정한 내용입니다.");
  await section.getByRole("button", { name: "소개 저장" }).click();
  await expect(section.getByText("내 소개만 수정한 내용입니다.")).toBeVisible();
  await section.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(section.getByText("내 소개만 수정한 내용입니다.")).toHaveCount(
    0,
  );
  await expect(section.getByText(original.body)).toBeVisible();
});

test("proposals can be submitted without an introduction", async ({ page }) => {
  let submission: { rationale?: string } | null = null;
  await page.route("**/api/places/search", (route) =>
    route.fulfill({
      json: { internal: [internalPlace("새로 추천할 장소")], candidates: [] },
    }),
  );
  await page.route("**/api/places/propose", (route) => {
    submission = route.request().postDataJSON();
    return route.fulfill({
      json: { id: "proposal", status: "pending", created: true },
    });
  });
  await open(page);
  await page
    .getByRole("textbox", { name: "제안할 장소 검색" })
    .fill("새로 추천");
  await page
    .getByRole("button", { name: /새로 추천할 장소.*추천 가능/ })
    .click();
  await expect(page.getByLabel("한줄 소개 (선택)")).toHaveValue("");
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  await page.getByRole("button", { name: "장소 제안하기" }).click();
  await expect.poll(() => submission).toMatchObject({ rationale: "" });
});
const internalPlace = (name: string, status: string | null = null) => ({
  id: "22222222-2222-4222-8222-222222222222",
  name,
  address: "서울 용산구",
  category: "가게",
  locality: "서울",
  lat: 37,
  lng: 127,
  currentMapStatus: status,
  currentMapPlaceId:
    status === "pending" || status === "approved" ? "existing-proposal" : null,
});
test("workflow layouts fit the viewport", async ({ page }, testInfo) => {
  await open(page, "admin");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("admin.png"),
    fullPage: true,
  });
  await open(page);
  await page.getByText("찾는 장소가 없나요? 직접 등록").click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("proposal.png"),
    fullPage: true,
  });
});
test("late search results cannot replace a newer query or reopen manual registration", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let oldStarted = false;
  await page.route("**/api/places/search", async (route) => {
    const { query } = route.request().postDataJSON();
    if (query === "이전") {
      oldStarted = true;
      await pending;
    }
    await route
      .fulfill({
        json: {
          internal: [internalPlace(query === "이전" ? "이전 결과" : "새 결과")],
          candidates: [],
        },
      })
      .catch(() => {});
  });
  await open(page);
  const input = page.getByRole("textbox", { name: "제안할 장소 검색" });
  await input.fill("이전");
  await expect.poll(() => oldStarted).toBe(true);
  await input.fill("최신");
  await expect(page.getByRole("button", { name: /새 결과/ })).toBeVisible();
  release!();
  await expect(page.getByRole("button", { name: /이전 결과/ })).toHaveCount(0);
  await page.getByText("찾는 장소가 없나요? 직접 등록").click();
  await expect(page.getByLabel("장소 이름", { exact: true })).toBeVisible();
});
test("existing statuses guide users and a selected place submits only once", async ({
  page,
}) => {
  await page.route("**/api/places/search", (route) => {
    const { query } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        internal: [
          internalPlace(
            "확인할 가게",
            query === "대기" ? "pending" : query === "거절" ? "reviewed" : null,
          ),
        ],
        candidates: [],
      },
    });
  });
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  await page.route("**/api/places/propose", async (route) => {
    count++;
    await pending;
    await route.fulfill({
      json: {
        id: "result",
        placeId: "place",
        status: "pending",
        created: true,
      },
    });
  });
  await open(page);
  const input = page.getByRole("textbox", { name: "제안할 장소 검색" });
  await input.fill("대기");
  await page.getByRole("button", { name: /확인할 가게.*검토 대기/ }).click();
  await expect(
    page.getByRole("button", { name: "지도에서 보기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "계속 검색" }).click();
  await input.fill("거절");
  await page.getByRole("button", { name: /확인할 가게.*이미 검토됨/ }).click();
  await expect(page.getByRole("button", { name: "지도에서 보기" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "계속 검색" }).click();
  await input.fill("추천");
  await page.getByRole("button", { name: /확인할 가게.*추천 가능/ }).click();
  await expect(page.getByText("선택한 장소: 확인할 가게")).toContainText(
    "서울 용산구",
  );
  await page.getByLabel("한줄 소개 (선택)").fill("추천하는 이유입니다");
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  expect(count).toBe(0);
  await expect(
    page.getByRole("region", { name: "제출할 제안 내용" }),
  ).toContainText("추천하는 이유입니다");
  await page.getByRole("button", { name: "이전 단계" }).click();
  await expect(page.getByLabel("한줄 소개 (선택)")).toHaveValue(
    "추천하는 이유입니다",
  );
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  await page.getByRole("button", { name: "장소 제안하기" }).click();
  await expect(page.getByRole("button", { name: "보내는 중…" })).toBeDisabled();
  await expect(input).toBeHidden();
  await expect(page.getByRole("button", { name: "이전 단계" })).toBeDisabled();
  expect(count).toBe(1);
  release!();
  await expect(page).toHaveURL(
    /maps\/test-map\?proposal=result&submitted=1&created=1/,
  );
});
test("admin URL restores tabs and status and tabs support keyboard navigation", async ({
  page,
}) => {
  await open(page, "admin");
  await page.getByRole("button", { name: "재검토", exact: true }).click();
  await expect(page).toHaveURL(/status=disputed/);
  await page.getByRole("tab", { name: "운영 이력" }).click();
  await page.reload();
  await page.addScriptTag({ content: bundle });
  await expect(page.getByRole("tab", { name: "운영 이력" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("사진 숨김", { exact: true })).toBeVisible();
  await expect(page.getByText("사진: photo", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "운영 이력" }).focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "장소 검토 2" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("검토할 장소가 없습니다.")).toBeVisible();
});
test("unauthenticated users cannot open admin moderation", async ({ page }) => {
  await page.goto("/admin/moderation");
  await expect(page).toHaveURL(/\/login/);
});
test("automatic suggestions wait 400ms, respect composition and keep external search available", async ({
  page,
}) => {
  const requests: { query: string; external: boolean }[] = [];
  await page.route("**/api/places/search", (route) => {
    const input = route.request().postDataJSON();
    requests.push(input);
    return route.fulfill({
      json: {
        internal: input.query === "등록" ? [internalPlace("등록된 가게")] : [],
        candidates: input.external
          ? [
              {
                provider: "kakao",
                externalId: "candidate",
                token: "candidate-token",
                label: "가게 후보",
                address: "서울 용산구",
                category: "",
                attribution: "Kakao Maps",
              },
            ]
          : [],
      },
    });
  });
  await open(page);
  const input = page.getByRole("textbox", { name: "제안할 장소 검색" });
  await input.fill("가");
  await page.waitForTimeout(650);
  expect(requests).toHaveLength(0);
  await input.dispatchEvent("compositionstart");
  await input.fill("가ㄱ");
  await page.waitForTimeout(650);
  expect(requests).toHaveLength(0);
  await input.fill("かな");
  await page.waitForTimeout(650);
  expect(requests).toHaveLength(0);
  // Freeze timers before committing the IME. Committing searches immediately
  // without waiting for the 400ms typing debounce.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await input.fill("がけ");
  await input.dispatchEvent("compositionend");
  await expect(page.getByRole("button", { name: /가게 후보/ })).toBeVisible();
  expect(requests).toEqual([
    expect.objectContaining({
      query: "がけ",
      external: true,
      translate: false,
    }),
  ]);
  await input.fill("등록");
  await page.clock.runFor(300);
  expect(requests.filter((r) => r.query === "등록")).toHaveLength(0);
  await page.clock.runFor(150);
  await expect(
    page.getByRole("button", { name: /등록된 가게.*추천 가능/ }),
  ).toBeVisible();
  await page.waitForTimeout(650);
  expect(requests.filter((r) => r.query === "등록")).toEqual([
    expect.objectContaining({
      query: "등록",
      external: true,
      translate: false,
    }),
  ]);
});
test("complete Korean syllables search while focused before composition ends", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route("**/api/places/search", (route) => {
    queries.push(route.request().postDataJSON().query);
    return route.fulfill({
      json: { internal: [internalPlace("스타 장소 후보")], candidates: [] },
    });
  });
  await open(page);
  const input = page.getByRole("textbox", { name: "제안할 장소 검색" });
  await input.focus();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await input.dispatchEvent("compositionstart");
  await input.fill("ㅅ");
  await input.fill("스타");
  await page.clock.runFor(450);
  await expect(
    page.getByRole("button", { name: /스타 장소 후보/ }),
  ).toBeVisible();
  await expect(input).toBeFocused();
  expect(queries).toEqual(["스타"]);
  await input.dispatchEvent("compositionend");
  await expect(
    page.getByRole("button", { name: /스타 장소 후보/ }),
  ).toBeEnabled();
  expect(queries).toEqual(["스타"]);
  await input.dispatchEvent("compositionstart");
  await input.fill("스타ㅂ");
  await input.fill("스타벅");
  await page.clock.runFor(450);
  await expect.poll(() => queries).toEqual(["스타", "스타벅"]);
  await expect(input).toBeFocused();
});
test("manual entry validates fields, adjusts location and retains input after submit failure", async ({
  page,
}) => {
  await page.route("**/api/places/geocode", (route) =>
    route.fulfill({ json: { lat: 37, lng: 127, label: "서울" } }),
  );
  const submissions: Record<string, unknown>[] = [];
  await page.route("**/api/places/propose", (route) => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({
      status: 503,
      json: { error: "일시적인 저장 오류" },
    });
  });
  await open(page);
  await page.getByText("찾는 장소가 없나요? 직접 등록").click();
  await page.getByRole("button", { name: "이 장소로 계속" }).click();
  await expect(
    page.getByText("장소 이름을 입력해 주세요.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("장소 이름", { exact: true }).fill("새 가게");
  await page.getByLabel("주소", { exact: true }).fill("서울시 용산구 주소");
  await page.getByRole("button", { name: "주소에서 위치 찾기" }).click();
  await page.getByRole("button", { name: "테스트 지도 위치 조정" }).click();
  await page.getByRole("button", { name: "이 장소로 계속" }).click();
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  await expect(
    page.getByRole("region", { name: "제출할 제안 내용" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "이전 단계" }).click();
  await page.getByLabel("한줄 소개 (선택)").fill("추천할 만한 가게입니다");
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  await page.getByRole("button", { name: "장소 제안하기" }).click();
  await expect(page.getByText("일시적인 저장 오류")).toBeVisible();
  await expect(page.getByLabel("한줄 소개 (선택)")).toHaveValue(
    "추천할 만한 가게입니다",
  );
  expect(submissions[0]).toMatchObject({ lat: 37.5, lng: 127.1 });
});
test("admin tabs restore through history, filters and ordering work, errors retain reason", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/api/community", (route) =>
    route.fulfill(
      failing ? { status: 503, json: { error: "처리 실패" } } : { json: {} },
    ),
  );
  await open(page, "admin");
  const articles = page.locator("article");
  await expect(articles.first()).toContainText("오래된 장소");
  await page.getByLabel("장소 검토 정렬").selectOption("newest");
  await expect(articles.first()).toContainText("새 장소");
  await page.getByLabel("검토할 장소 검색").fill("특별주소");
  await expect(articles).toHaveCount(1);
  await page.getByRole("tab", { name: "신고 3" }).click();
  await expect(page).toHaveURL(/tab=reports/);
  await page.getByLabel("신고 유형").selectOption("photo");
  await expect(articles).toHaveCount(1);
  await page.getByRole("button", { name: "사진 숨기기" }).click();
  await page.getByLabel("처리 근거").fill("운영자가 사진을 확인했습니다");
  await page.getByRole("button", { name: "확인하고 실행" }).click();
  await expect(page.getByRole("alert")).toHaveText("처리 실패");
  await expect(page.getByLabel("처리 근거")).toHaveValue(
    "운영자가 사진을 확인했습니다",
  );
  failing = false;
  await page.getByRole("button", { name: "확인하고 실행" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "운영 조치가 완료되었습니다.",
  );
  await expect(page.getByRole("tab", { name: "신고 3" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goBack();
  await expect(page.getByRole("tab", { name: "장소 검토 2" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "중복 후보 1" }).click();
  await page.getByRole("button", { name: "병합 검토" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "원본 “원본 가게” → 목적 “목적 가게”",
  );
});

test("keeps previous candidates disabled during a new query and reuses the previous result", async ({
  page,
}) => {
  const queries: string[] = [];
  let finish: (() => Promise<void>) | undefined;
  await page.route("**/api/places/search", (route) => {
    const { query } = route.request().postDataJSON();
    queries.push(query);
    if (query === "느린검색") {
      finish = () =>
        route.fulfill({
          json: { internal: [internalPlace("느린검색 결과")], candidates: [] },
        });
      return;
    }
    return route.fulfill({
      json: { internal: [internalPlace("빠른검색 결과")], candidates: [] },
    });
  });
  await open(page);
  const input = page.getByRole("textbox", { name: "제안할 장소 검색" });
  await input.fill("빠른검색");
  const prior = page.getByRole("button", { name: /빠른검색 결과/ });
  await expect(prior).toBeEnabled();
  await input.fill("느린검색");
  await expect(prior).toBeVisible();
  await expect(prior).toBeDisabled();
  await expect.poll(() => queries).toContain("느린검색");
  await input.fill("빠른검색");
  await expect(prior).toBeEnabled();
  expect(queries.filter((q) => q === "빠른검색")).toHaveLength(1);
  await finish?.().catch(() => {});
  await expect(page.getByRole("button", { name: /느린검색 결과/ })).toHaveCount(
    0,
  );
});
test("Japanese translation is explicit and world search explains limited data", async ({
  page,
}) => {
  const requests: { translate: boolean }[] = [];
  await page.route("**/api/places/search", (route) => {
    const input = route.request().postDataJSON();
    requests.push(input);
    return route.fulfill({
      json: {
        internal: input.translate ? [internalPlace("翻訳した場所")] : [],
        candidates: [],
        translationAvailable: !input.translate,
      },
    });
  });
  await open(page, "japan");
  await page.getByRole("textbox", { name: "제안할 장소 검색" }).fill("vintage");
  await expect(
    page.getByRole("button", { name: "일본어 이름으로 찾아보기" }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].translate).toBe(false);
  await page.getByRole("button", { name: "일본어 이름으로 찾아보기" }).click();
  await expect(
    page.getByRole("button", { name: /翻訳した場所/ }),
  ).toBeVisible();
  expect(requests[1].translate).toBe(true);
  await open(page, "world");
  await expect(
    page.getByText("현재 확보된 지역 데이터에서 검색합니다."),
  ).toBeVisible();
  await page.getByText("찾는 장소가 없나요? 직접 등록").click();
  await expect(page.getByLabel("국가", { exact: true })).toBeVisible();
});

test("Enter shares an active automatic search and request limits retain manual registration", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => Promise<void>;
  await page.route("**/api/places/search", (route) => {
    requests++;
    release = () =>
      route.fulfill({
        status: 429,
        json: { error: "외부 검색 요청 한도에 도달했습니다." },
      });
  });
  await open(page);
  const input = page.getByRole("textbox", { name: "제안할 장소 검색" });
  await input.fill("한도검색");
  await expect.poll(() => requests).toBe(1);
  await input.press("Enter");
  await input.press("Enter");
  expect(requests).toBe(1);
  await release();
  await expect(
    page.getByText("외부 검색 요청 한도에 도달했습니다."),
  ).toBeVisible();
  await page.getByText("찾는 장소가 없나요? 직접 등록").click();
  await expect(page.getByLabel("장소 이름", { exact: true })).toBeVisible();
});

test("summary photo preview loads thumbnails and opens detail without showing upload controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.route("**/api/places/*/photos", (route) =>
    route.fulfill({
      json: {
        photos: [
          {
            id: "photo-one",
            place_id: "place-one",
            author_id: null,
            handle: "visitor",
            caption: "방문자 사진 설명",
            width: 600,
            height: 400,
            created_at: "2026-10-12T00:00:00Z",
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route("**/api/photos/*/image?*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>',
    }),
  );
  await open(page, "photo-preview");
  const photo = page.getByRole("button", { name: "사진 1 장소 상세에서 보기" });
  await expect(photo).toBeVisible();
  await expect(photo.getByRole("img")).toHaveAttribute(
    "src",
    "/api/photos/photo-one/image?size=thumbnail",
  );
  await expect(page.getByRole("button", { name: "사진 추가" })).toHaveCount(0);
  await photo.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-opened-photo-detail",
    "true",
  );
});

for (const photoCount of [0, 1, 6, -1]) {
  test(`mobile sheet long content and photo state ${photoCount} fit all stages`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile);
    const duplicateKeyWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("same key"))
        duplicateKeyWarnings.push(message.text());
    });
    await page.route("**/api/places/*/photos", (route) =>
      route.fulfill(
        photoCount < 0
          ? { status: 503, json: { error: "사진 조회 실패" } }
          : {
              json: {
                photos: Array.from({ length: photoCount }, (_, i) => ({
                  id: `photo-${i}`,
                  place_id: "place-one",
                  author_id: null,
                  handle: "visitor",
                  caption: `사진 ${i}`,
                  width: 600,
                  height: 400,
                  created_at: "2026-10-12T00:00:00Z",
                })),
                nextCursor: null,
              },
            },
      ),
    );
    await page.route("**/api/map-places/**", (route) =>
      route.fulfill({
        json: { comments: [], checks: [], introductions: [], summary: {} },
      }),
    );
    await page.route("**/api/places/*/stations", (route) =>
      route.fulfill({ json: { stations: [], available: false } }),
    );
    await page.route("**/api/photos/*/image?*", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>',
      }),
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "place-sheet");
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 740 });
      const card = page.locator(".mobile-place-carousel");
      await expect(card).toHaveAttribute("data-sheet-stage", "summary");
      const name = await card.getByRole("heading", { level: 2 }).innerText();
      await page.screenshot({
        path: `artifacts/sheet-summary-title-${photoCount}-${width}.png`,
      });
      const title = (await card
        .getByRole("heading", { level: 2 })
        .boundingBox())!;
      const close = (await card
        .getByRole("button", { name: "장소 카드 닫기" })
        .boundingBox())!;
      expect(title.x + title.width).toBeLessThanOrEqual(close.x);

      const preview = card.getByRole("region", {
        name: "방문자 사진 미리보기",
      });
      if (photoCount === 0) await expect(preview).toHaveCount(0);
      else if (photoCount > 0)
        await expect(preview.getByRole("img")).toHaveCount(
          Math.min(5, photoCount),
        );
      else await expect(preview).toContainText("상세에서 다시 확인");
      expect((await card.boundingBox())!.height).toBeLessThanOrEqual(385);
      await page.screenshot({
        path: `artifacts/sheet-summary-${photoCount}-${width}.png`,
      });
      await card
        .getByRole("button", { name: "장소 상세 펼치기", exact: true })
        .click();
      const detail = page.getByRole("dialog", { name: `${name} 장소 상세` });
      await expect(detail).toBeVisible();
      await page.screenshot({
        path: `artifacts/sheet-detail-top-${photoCount}-${width}.png`,
      });
      const initialActionBounds = (await detail
        .locator(".place-detail-heading")
        .boundingBox())!;
      const scroll = detail.locator(".place-detail-scroll");
      const reasons = detail.getByRole("region", {
        name: "장소 소개",
        exact: true,
      });
      const photoSection = detail.getByRole("region", {
        name: "방문자 사진",
        exact: true,
      });
      expect((await reasons.boundingBox())!.y).toBeLessThan(
        (await photoSection.boundingBox())!.y,
      );
      await scroll.evaluate((el) => (el.scrollTop = el.scrollHeight));
      const actions = (await detail
        .locator(".place-detail-heading")
        .boundingBox())!;
      expect(actions.y).toBeCloseTo(initialActionBounds.y, 0);
      expect(actions.y + actions.height).toBeLessThanOrEqual(741);
      expect(actions.y).toBeGreaterThan(0);
      await detail
        .locator(".participation-section")
        .filter({ hasText: "더 보기" })
        .locator("summary")
        .click();
      await expect(
        detail.getByRole("link", { name: "장소 소개 페이지 보기" }),
      ).toBeVisible();
      if (photoCount > 0) {
        await photoSection.getByRole("button", { name: /사진 1 확대/ }).click();
        await expect(page.locator("[data-photo-dialog]")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("[data-photo-dialog]")).toHaveCount(0);
        await expect(detail).toBeVisible();
      }
      await page.screenshot({
        path: `artifacts/sheet-detail-${photoCount}-${width}.png`,
      });
      await detail
        .getByRole("button", { name: "장소 상세 닫기", exact: true })
        .click();
      await expect(card).toHaveCount(0);
      const peek = page.getByRole("region", { name: "접힌 장소 카드" });
      await expect(peek).toBeVisible();
      const peekBox = (await peek.boundingBox())!;
      expect(peekBox.width).toBeGreaterThan(width - 30);
      expect(peekBox.height).toBeLessThanOrEqual(60);
      expect(peekBox.y + peekBox.height).toBeCloseTo(740, 0);
      await peek
        .getByRole("button", { name: "장소 카드 펼치기", exact: true })
        .click();
    }
    expect(duplicateKeyWarnings).toEqual([]);
  });
}

test("seven mobile home cards center the latest selection and close the previous card", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "home-cards");
  const cards = page.locator("[data-mobile-story-home] article");
  await expect(cards).toHaveCount(7);
  for (const index of [0, 1]) {
    const card = cards.nth(index);
    const before = await page.evaluate(() => window.scrollY);
    await card
      .locator("button[aria-expanded]")
      .evaluate((element) => (element as HTMLButtonElement).click());
    await expect(card).toHaveAttribute("data-expanded", "true");
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    expect(
      await card
        .locator("..")
        .evaluate((element) => (element as HTMLElement).style.paddingTop),
    ).toBe("");
  }
  for (const index of [2, 3, 6]) {
    const card = cards.nth(index);
    await card.locator("button[aria-expanded]").click();
    await expect
      .poll(async () => {
        const rect = (await card.boundingBox())!;
        return Math.abs(rect.y + rect.height / 2 - 422);
      })
      .toBeLessThan(3);
    await expect(page.locator('article[data-expanded="true"]')).toHaveCount(1);
  }
  await cards
    .first()
    .locator("button[aria-expanded]")
    .evaluate((element) => (element as HTMLButtonElement).click());
  await cards
    .nth(4)
    .locator("button[aria-expanded]")
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect
    .poll(async () => {
      const rect = (await cards.nth(4).boundingBox())!;
      return Math.abs(rect.y + rect.height / 2 - 422);
    })
    .toBeLessThan(3);
  await expect(cards.first()).toHaveAttribute("data-expanded", "false");
  await page.screenshot({ path: "artifacts/home-seven-cards-centered.png" });
});

for (const width of [320, 390, 768]) {
  test(`mobile list mixed photos, text fallback and separate save at ${width}px`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile);
    await page.clock.setFixedTime(new Date("2026-10-13T00:00:00Z"));
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/places/*/photos", (route) =>
      route.fulfill({
        json: {
          photos: route.request().url().includes("000000000001/")
            ? [{ id: "list-photo" }]
            : [],
        },
      }),
    );
    await page.route("**/api/photos/*/image?*", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76"><rect width="76" height="76" fill="#abc"/></svg>',
      }),
    );
    await open(page, "mobile-list");
    const rows = page.locator(".mobile-list-place");
    await expect(rows.first().locator("img")).toBeVisible();
    await expect(rows.nth(1).locator("img")).toHaveCount(0);
    const photo = (await rows.first().locator("img").boundingBox())!;
    expect(photo.width).toBe(76);
    expect(photo.height).toBe(76);
    const titleText = (await rows
      .first()
      .locator(".mobile-list-title-text")
      .boundingBox())!;
    expect(titleText.height).toBeLessThanOrEqual(48);
    const titleBox = (await rows
      .first()
      .locator(".mobile-list-title")
      .boundingBox())!;
    const badgeBox = (await rows
      .first()
      .locator(".mobile-list-badges")
      .boundingBox())!;
    expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(badgeBox.y);
    const titleX = (await rows
      .first()
      .locator(".mobile-list-title")
      .boundingBox())!.x;
    expect(titleX).toBeGreaterThanOrEqual(photo.x + photo.width + 12);
    const plainTitle = (await rows
      .nth(1)
      .locator(".mobile-list-title")
      .boundingBox())!;
    const plainCopy = (await rows
      .nth(1)
      .locator(".mobile-list-copy")
      .boundingBox())!;
    expect(plainTitle.x).toBe(plainCopy.x);
    expect(plainTitle.x).toBe(photo.x);
    const save = rows.first().locator(".mobile-list-save");
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("선택 장소")).toHaveText("선택 없음");
    await rows.first().locator(".mobile-list-title").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("선택 장소")).toHaveText("list-0");
    await expect(rows.first()).toHaveAttribute("data-selected", "true");
    await page.screenshot({ path: `artifacts/mobile-list-${width}.png` });
    await page.getByRole("button", { name: "지도 전환" }).click();
    await expect(rows).toHaveCount(0);
  });
}

test("mobile list limits pending photos, survives failures and cancels on exit", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  const pending: import("@playwright/test").Route[] = [];
  await page.route("**/api/places/*/photos", (route) => {
    pending.push(route);
  });
  await open(page, "mobile-list");
  await expect.poll(() => pending.length).toBe(3);
  await pending[0].fulfill({ status: 500, json: { error: "failed" } });
  await expect.poll(() => pending.length).toBe(4);
  await expect(
    page.locator(".mobile-list-place").first().locator("img"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "지도 전환" }).click();
  await expect(page.locator(".mobile-list-place")).toHaveCount(0);
});

test("mobile list drops unavailable images without leaving a placeholder", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  let imageRequests = 0;
  await page.route("**/api/places/*/photos", (route) =>
    route.fulfill({ json: { photos: [{ id: "hidden-photo" }] } }),
  );
  await page.route("**/api/photos/*/image?*", (route) => {
    imageRequests++;
    return route.fulfill({ status: 404, body: "" });
  });
  await open(page, "mobile-list");
  await expect.poll(() => imageRequests).toBeGreaterThan(0);
  await expect(
    page.locator(".mobile-list-place").first().locator("img"),
  ).toHaveCount(0);
  await expect(
    page.locator(".mobile-list-place").first().locator(".mobile-list-reason"),
  ).toBeVisible();
  await expect(page.getByLabel("선택 장소")).toHaveText("선택 없음");
});

test("creator studio manages profile, maps and covers on desktop and mobile", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 390, height: 844 });
  const id = "11111111-1111-4111-8111-111111111111";
  const creatorMap = {
    id,
    slug: "test-map",
    title: "테스트 지도",
    city: "서울",
    country: "KR",
    search_scope: "country",
    description: "",
    rules: "",
    tags: [],
    bounds: { west: 126, east: 128, south: 36, north: 38 },
    created_at: "",
    kind: "creator",
    owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "draft",
    position: 0,
    cover_path: null,
    hidden_at: null,
  };
  const snapshot = { profile: null as unknown, maps: [creatorMap] };
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/creator/maps", async (route) => {
    if (route.request().method() === "POST") {
      const command = route.request().postDataJSON();
      calls.push(command);
      if (command.action === "status") snapshot.maps[0].status = command.status;
      if (command.action === "update") snapshot.maps[0].title = command.title;
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: { snapshot } });
  });
  await page.route("**/api/creator/maps/*/places", (route) =>
    route.fulfill({ json: [] }),
  );
  await open(page, "creator-studio");
  await expect(
    page.getByRole("heading", { name: "크리에이터 스튜디오" }),
  ).toBeVisible();
  await page.getByText("대표 지도", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "대표 지도 저장", exact: true })
    .click();
  await expect
    .poll(() =>
      calls.some((x) => x.action === "profile" && x.featuredMapId === ""),
    )
    .toBe(true);
  await expect(page.getByRole("status")).toContainText("저장했어요");
  await page.getByLabel("지도 제목", { exact: true }).fill("새 지도 제목");
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  await expect
    .poll(() =>
      calls.some((x) => x.action === "update" && x.title === "새 지도 제목"),
    )
    .toBe(true);
  await page.getByRole("button", { name: "공개로 전환", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "공개 지도 보기", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "장소 추가", exact: true }),
  ).toHaveAttribute("href", `/studio/${id}/add`);
  await page.getByLabel("커버 선택", { exact: false }).setInputFiles({
    name: "too-large.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toContainText("5MB 이하");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/creator-studio-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("place detail exposes compact participation and replaces its body with an interactive comment thread", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const comments = [
    "한 줄 댓글",
    "내용이 길어져도 좋아요의 위치는 바뀌지 않는 댓글입니다. ".repeat(4),
  ].map((body, i) => ({
    id: `comment-${i}`,
    body,
    handle: `visitor${i}`,
    author_id: "other",
    created_at: "2026-10-17T00:00:00Z",
    likes: i,
    liked: false,
  }));
  await page.route("**/api/map-places/*/comments*", (route) =>
    route.fulfill({ json: { comments, total: comments.length } }),
  );
  await page.route("**/api/map-places/*/introductions", (route) =>
    route.fulfill({
      json: {
        introductions: [
          {
            id: "intro",
            body: "방문자가 소개한 장소의 특징입니다.",
            handle: "curator",
            author_id: "other",
          },
        ],
      },
    }),
  );
  await page.route("**/api/places/*/photos*", (route) =>
    route.fulfill({ json: { photos: [], nextCursor: null } }),
  );
  await page.route("**/api/places/*/stations", (route) =>
    route.fulfill({ json: { stations: [], status: "unsupported" } }),
  );
  await page.route("**/api/community", (route) => {
    const input = route.request().postDataJSON();
    if (input.action === "comment")
      comments.push({
        id: "new",
        body: input.body,
        handle: "visitor",
        author_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        created_at: "2026-10-17T01:00:00Z",
        likes: 0,
        liked: false,
      });
    return route.fulfill({ json: {} });
  });
  await page.route("**/api/comments/*/like", (route) => {
    const input = route.request().postDataJSON();
    comments[0].liked = input.enabled;
    comments[0].likes = input.enabled ? 1 : 0;
    return route.fulfill({
      json: { liked: comments[0].liked, likes: comments[0].likes },
    });
  });
  await open(page, "place-introductions");
  const detail = page.locator(".place-detail-panel");
  await expect(detail.locator(".place-save-bar")).toHaveCount(0);
  await expect(
    detail
      .locator(".detail-heading-actions")
      .getByRole("button", { name: /공유$/ }),
  ).toBeVisible();
  const stations = detail.locator(".station-disclosure");
  await expect(stations).not.toHaveAttribute("open");
  await stations.locator("summary").click();
  await expect(stations).toHaveAttribute("open", "");
  await stations.locator("summary").click();
  await expect(stations).not.toHaveAttribute("open");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        detail.locator(".single-line-text").evaluateAll((elements) =>
          elements.every((el) => {
            const text = el.firstElementChild!;
            return (
              getComputedStyle(el).whiteSpace === "nowrap" &&
              // Compare untransformed integer CSS widths on both sides;
              // boundingClientRect includes fractional pixels and transforms.
              text.scrollWidth <= el.clientWidth
            );
          }),
        ),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(
    detail.getByRole("heading", { name: "장소 소개", exact: true }),
  ).toHaveCount(0);
  await expect(detail.locator(".place-theme-reactions")).toContainText(
    "에 어울리는 장소인가요?",
  );
  await expect(
    detail
      .locator(".place-stations-section")
      .getByRole("link", { name: "길찾기", exact: true }),
  ).toHaveAttribute("href", /^\/go\//);
  await detail.getByRole("button", { name: "장소 소개 메뉴" }).click();
  await page
    .getByRole("menuitem", { name: "소개 추가하기", exact: true })
    .click();
  await expect(page.getByLabel("장소 소개 추가")).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await detail
    .getByRole("button", { name: "댓글 2개 모두 보기", exact: true })
    .click();
  await expect(detail).toHaveAttribute("data-mode", "comments");
  await expect(
    detail.getByRole("heading", { name: "댓글 2", exact: true }),
  ).toBeFocused();
  const rows = detail.locator(".place-comment-row");
  const positions = await rows.evaluateAll((items) =>
    items.map((item) => {
      const button = item
        .querySelector(".comment-like")!
        .getBoundingClientRect();
      const row = item.getBoundingClientRect();
      return { x: button.x, offsetY: button.y - row.y };
    }),
  );
  expect(positions[0]).toEqual(positions[1]);
  await detail
    .getByRole("button", { name: "@visitor0 댓글 좋아요 0", exact: true })
    .click();
  await expect(
    detail.getByRole("button", {
      name: "@visitor0 댓글 좋아요 1",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("댓글", { exact: true })
    .fill("새로 작성한 댓글입니다.");
  await page.getByRole("button", { name: "댓글 등록", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "댓글 3", exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByText("새로 작성한 댓글입니다.", { exact: true }),
  ).toBeVisible();
  await detail
    .getByRole("button", { name: "@visitor 댓글 메뉴", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "삭제", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "신고", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await detail
    .getByRole("button", { name: "장소 상세로 돌아가기", exact: true })
    .click();
  await expect(
    detail.getByRole("button", { name: "댓글 3개 모두 보기", exact: true }),
  ).toBeFocused();
  await expect(detail).toHaveAttribute("data-mode", "detail");
});

test("optimistic mutations share state, isolate pending actions and roll back failures", async ({
  page,
}) => {
  const calls: { action: string; enabled?: boolean }[] = [];
  let release: (() => void) | undefined;
  let fail = false;
  let reads = 0;
  await page.route("**/api/community", async (route) => {
    calls.push(route.request().postDataJSON());
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      status: fail ? 500 : 200,
      json: fail ? { error: "요청 실패" } : { ok: true },
    });
  });
  await page.route("**/api/map-places/*/comments*", (route) => {
    reads++;
    return route.fulfill({ json: { comments: [], total: reads } });
  });
  await open(page, "mutations");
  await expect(page.getByLabel("공유 댓글 수").first()).toHaveText("1");
  await expect(page.getByLabel("공유 댓글 수").last()).toHaveText("1");
  expect(reads).toBe(1);
  const save = page.getByRole("button", { name: "저장 테스트", exact: true });
  const vote = page.getByRole("button", { name: "추천 테스트", exact: true });
  const follow = page.getByRole("button", {
    name: "팔로우 테스트",
    exact: true,
  });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).toBeDisabled();
  await expect(vote).toBeEnabled();
  await expect.poll(() => calls.length).toBe(1);
  release!();
  await expect(save).toBeEnabled();
  expect(calls[0]).toMatchObject({ action: "save", enabled: true });
  fail = true;
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => calls.length).toBe(2);
  release!();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("오류", { exact: true })).toHaveText(
    "요청 실패",
  );
  fail = false;
  const initial = Number(
    await page.getByLabel("추천 수", { exact: true }).innerText(),
  );
  await vote.click();
  await expect(vote).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("추천 수", { exact: true })).toHaveText(
    String(initial + 1),
  );
  await expect.poll(() => calls.length).toBe(3);
  release!();
  await expect(vote).toBeEnabled();
  await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => calls.length).toBe(4);
  release!();
  await expect(follow).toBeEnabled();
  await page.getByRole("button", { name: "서버 데이터 갱신" }).click();
  await expect(page.getByLabel("추천 수", { exact: true })).toHaveText("20");
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "사용자 전환" }).click();
  await expect(vote).toHaveAttribute("aria-pressed", "false");
  await expect(follow).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("공유 댓글 수").first()).toHaveText("2");
  expect(reads).toBe(2);
});

async function openPersonalizedDetail(page: Page, mobile: boolean) {
  if (mobile) {
    await page
      .getByRole("button", { name: "장소 목록 펼치기", exact: true })
      .click();
    await page
      .locator(".mobile-place-overview .mobile-list-place")
      .first()
      .click();
    await page
      .getByRole("button", { name: "장소 상세 펼치기", exact: true })
      .click();
  } else {
    await page
      .locator(".place-list .place-glass-card")
      .first()
      .getByRole("button")
      .first()
      .click();
  }
  await expect(page.locator(".place-detail-panel")).toBeVisible();
}
async function mockPersonalizationReads(page: Page) {
  await page.route("**/api/map-places/*/comments*", (r) =>
    r.fulfill({ json: { comments: [], total: 0 } }),
  );
  await page.route("**/api/map-places/*/checks*", (r) =>
    r.fulfill({ json: { checks: [], summary: {} } }),
  );
  await page.route("**/api/places/*/photos*", (r) =>
    r.fulfill({ json: { photos: [], nextCursor: null } }),
  );
  await page.route("**/api/places/*/stations*", (r) =>
    r.fulfill({ json: { stations: [], status: "unsupported" } }),
  );
  await page.route("**/api/maps/*/search*", (r) =>
    r.fulfill({
      json: {
        mode: "local",
        items: [],
        total: 0,
        hasMore: false,
        suggestions: [],
        station: null,
        stationsStatus: "preparing",
      },
    }),
  );
}
for (const vote of [1, -1]) {
  test(`anonymous vote ${vote} survives re-entry and toggles off`, async ({
    page,
    isMobile,
  }) => {
    await mockPersonalizationReads(page);
    const calls: unknown[] = [];
    await page.route("**/api/community", async (r) => {
      calls.push(r.request().postDataJSON());
      await r.fulfill({ json: { ok: true } });
    });
    for (let visit = 0; visit < 2; visit++) {
      await open(page, `personalization&vote=${vote}`);
      await openPersonalizedDetail(page, isMobile);
      const reaction = page.locator(".place-detail-panel").getByRole("button", {
        name:
          vote === 1 ? /^이 지도에 어울려요 / : /^이 지도에 어울리지 않아요 /,
      });
      await expect(reaction).toHaveAttribute("aria-pressed", "true");
      if (visit === 1) {
        await reaction.click();
        await expect(reaction).toHaveAttribute("aria-pressed", "false");
        await expect.poll(() => calls.length).toBe(1);
        expect(calls[0]).toMatchObject({ action: "vote", value: 0 });
      }
    }
  });
}
test("late personalization preserves local votes and user/map changes clear them", async ({
  page,
  isMobile,
}) => {
  await mockPersonalizationReads(page);
  await page.route("**/api/community", (r) =>
    r.fulfill({ json: { ok: true } }),
  );
  await open(page, "personalization&delayed=1&vote=1");
  await openPersonalizedDetail(page, isMobile);
  const dialog = page.locator(".place-detail-panel");
  const down = dialog.getByRole("button", {
    name: /^이 지도에 어울리지 않아요 /,
  });
  const up = dialog.getByRole("button", { name: /^이 지도에 어울려요 / });
  await down.click();
  await expect(down).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", {
      name: "서버 상태 수신",
      exact: true,
      includeHidden: true,
    })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(down).toHaveAttribute("aria-pressed", "true");
  await expect(up).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", {
      name: "로그인 상태 전환",
      exact: true,
      includeHidden: true,
    })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(down).toHaveAttribute("aria-pressed", "false");
  await down.click();
  await expect(down).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", {
      name: "다른 지도 전환",
      exact: true,
      includeHidden: true,
    })
    .evaluate((button: HTMLButtonElement) => button.click());
  await openPersonalizedDetail(page, isMobile);
  await expect(
    page
      .locator(".place-detail-panel")
      .getByRole("button", { name: /^이 지도에 어울리지 않아요 / }),
  ).toHaveAttribute("aria-pressed", "false");
});
