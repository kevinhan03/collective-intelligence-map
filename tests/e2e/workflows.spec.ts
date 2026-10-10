import { test, expect, type Page } from "@playwright/test";
import { build } from "vite";
import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
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
    define: { "process.env.NODE_ENV": '"production"' },
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
  bundle = output
    .filter((item) => item.type === "chunk")
    .map((item) => (item.type === "chunk" ? item.code : ""))
    .join("\n");
});
async function open(page: Page, fixture = "proposal") {
  await page.route("**/workflow-fixture*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html lang="ko" class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main id="root" class="page-wrap ${fixture === "admin" ? "max-w-4xl" : "max-w-2xl"}"></main></body></html>`,
    }),
  );
  await page.goto(`/workflow-fixture?fixture=${fixture}`);
  await page.addScriptTag({ content: bundle });
}
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
  await page.getByLabel("추천하는 점 한 줄").fill("추천하는 이유입니다");
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  expect(count).toBe(0);
  await expect(
    page.getByRole("region", { name: "제출할 제안 내용" }),
  ).toContainText("추천하는 이유입니다");
  await page.getByRole("button", { name: "이전 단계" }).click();
  await expect(page.getByLabel("추천하는 점 한 줄")).toHaveValue(
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
test("automatic suggestions are immediate, respect composition and search externally only without internal matches", async ({
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
  await input.fill("가게");
  await page.waitForTimeout(650);
  expect(requests).toHaveLength(0);
  // Freeze timers before committing the IME. A debounce timer could not fire,
  // whereas the input-event search must still reach the API.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await input.dispatchEvent("compositionend");
  await expect(page.getByRole("button", { name: /가게 후보/ })).toBeVisible();
  expect(requests).toEqual([
    expect.objectContaining({
      query: "가게",
      external: true,
      translate: false,
    }),
  ]);
  await input.fill("등록");
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
    page.getByText("추천 이유를 5~1,000자로 입력해 주세요."),
  ).toBeVisible();
  await page.getByLabel("추천하는 점 한 줄").fill("추천할 만한 가게입니다");
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  await page.getByRole("button", { name: "장소 제안하기" }).click();
  await expect(page.getByText("일시적인 저장 오류")).toBeVisible();
  await expect(page.getByLabel("추천하는 점 한 줄")).toHaveValue(
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
