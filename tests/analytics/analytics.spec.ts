import { test, expect, type Page } from "@playwright/test";
import { build } from "vite";
import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
let bundle = "",
  css = "";
type Event = { event: string; properties: Record<string, unknown> };
test.beforeAll(async () => {
  const primitives = resolve("tests/fixtures/primitives.tsx");
  const result = await build({
    configFile: false,
    resolve: {
      alias: [
        {
          find: "next/navigation",
          replacement: resolve("tests/fixtures/navigation.ts"),
        },
        { find: "next/link", replacement: "analytics-link" },
        { find: "next/image", replacement: "analytics-image" },
        {
          find: "@/components/map/map-canvas",
          replacement: resolve("tests/fixtures/workflow-map.tsx"),
        },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      {
        name: "analytics-primitives",
        resolveId(id) {
          if (id.startsWith("analytics-")) return id;
        },
        load(id) {
          if (id === "analytics-link")
            return `export { Link as default } from ${JSON.stringify(primitives)}`;
          if (id === "analytics-image")
            return `export { Image as default } from ${JSON.stringify(primitives)}`;
        },
      },
    ],
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN": '"phc_analytics_test"',
      "process.env.NEXT_PUBLIC_POSTHOG_HOST": '"https://analytics.test"',
      "process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID": '""',
      "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""',
    },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve("tests/analytics/fixture.tsx"),
        formats: ["iife"],
        name: "AnalyticsTests",
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
    .filter((x) => x.type === "chunk")
    .map((x) => (x.type === "chunk" ? x.code : ""))
    .join("\n");
  css = readdirSync(resolve(".next/static/chunks"))
    .filter((n) => n.endsWith(".css"))
    .map((n) => readFileSync(resolve(".next/static/chunks", n), "utf8"))
    .join("\n");
});
async function open(page: Page) {
  const events: Event[] = [];

  await page.addInitScript(() => {
    Object.assign(window, { process: { env: {}, browser: true } });
    // The real SDK intentionally ignores automation. Simulate a normal visitor
    // here without weakening production bot filtering.
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", {
      get: () => ({
        brands: [{ brand: "Chromium", version: "153" }],
        getHighEntropyValues: async () => ({}),
      }),
    });
  });
  await page.route("https://analytics.test/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.url().includes("/e/")) {
      const buffer = request.postDataBuffer()!;
      const raw = request.url().includes("compression=gzip-js")
        ? gunzipSync(buffer).toString()
        : buffer.toString();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        const value = new URLSearchParams(raw).get("data");
        if (!value) throw new Error(raw);
        data = JSON.parse(Buffer.from(value, "base64").toString());
      }
      events.push(...(Array.isArray(data) ? data : (data.batch ?? [data])));
    }
    await route.fulfill({
      json: {
        status: 1,
        featureFlags: {},
        config: {},
        autocapture_opt_out: false,
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  });
  await page.route("https://ting.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/_vercel/"))
      return route.fulfill({ contentType: "text/javascript", body: "" });
    if (url.pathname.startsWith("/api/"))
      return route.fulfill({
        json: {
          photos: [],
          maps: [],
          comments: [],
          items: [],
          introductions: [],
          tags: [],
          definitions: [],
          stations: [],
          total: 0,
          hasMore: false,
        },
      });
    return route.fulfill({
      contentType: "text/html",
      body: `<html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div></body></html>`,
    });
  });
  await page.goto("/maps/analytics-map");
  await page.addScriptTag({ content: bundle });
  await expect
    .poll(() => events.some((x) => x.event === "$pageview"), { timeout: 15000 })
    .toBe(true);
  return events;
}

test("real SDK captures public clicks without DOM text, forms, pending data or private-to-public leaks", async ({
  page,
}) => {
  const events = await open(page);
  await page
    .getByRole("button", { name: "leak@example.com SECRET_TOKEN", exact: true })
    .click();
  await expect
    .poll(
      () =>
        events.some(
          (x) =>
            x.event === "$autocapture" &&
            x.properties.control === "generic-public",
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "비공개 장소 버튼", exact: true })
    .click();
  await page.getByLabel("비밀 입력").fill("private@example.com");
  await page.getByRole("button", { name: "폼 내부 버튼", exact: true }).click();
  await page
    .getByRole("button", { name: "개인 화면으로", exact: true })
    .click();
  await page.getByRole("button", { name: "개인 버튼", exact: true }).click();
  await page
    .getByRole("button", { name: "공개 지도로 돌아가기", exact: true })
    .click();
  // A later safe click flushes queued batches, so exclusions are checked after ingestion.
  await page
    .getByRole("button", { name: "leak@example.com SECRET_TOKEN", exact: true })
    .click();
  await expect
    .poll(
      () =>
        events.filter(
          (x) =>
            x.event === "$autocapture" &&
            x.properties.control === "generic-public",
        ).length,
      { timeout: 15000 },
    )
    .toBe(2);
  const raw = JSON.stringify(events);
  for (const secret of [
    "leak@example.com",
    "SECRET_TOKEN",
    "private@example.com",
    "private-button",
    "private-return",
    "pending-place",
    "/saved",
  ])
    expect(raw).not.toContain(secret);
});

test("detail opens once per visit and save events reflect confirmed success, not failed or duplicate requests", async ({
  page,
  isMobile,
}) => {
  const events = await open(page);
  await page.locator("[data-analytics-id=generic-public]").evaluate((el) => {
    (el.parentElement as HTMLElement).style.display = "none";
  });
  if (isMobile) {
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await page
      .locator(".mobile-list-title")
      .filter({ hasText: "공개 장소" })
      .click();
    await page
      .getByRole("button", { name: "장소 상세 펼치기", exact: true })
      .click();
  } else
    await page
      .getByRole("button", { name: "공개 장소 상세 보기", exact: true })
      .click();
  await expect
    .poll(
      () => events.filter((x) => x.event === "place_detail_opened").length,
      { timeout: 15000 },
    )
    .toBe(1);
  expect(
    events.find((x) => x.event === "place_detail_opened")!.properties,
  ).toMatchObject({
    map_id: "11111111-1111-4111-8111-111111111111",
    place_id: "33333333-3333-4333-8333-333333333333",
  });
  let fail = true,
    requests = 0;
  await page.route("**/api/community", async (route) => {
    requests++;
    await route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { error: "저장 실패" } : { ok: true },
    });
  });
  const save = page
    .locator('[data-analytics-id="place-save"]')
    .filter({ visible: true })
    .last();
  await save.click();
  await expect(page.getByRole("alert").first()).toContainText("저장 실패");
  expect(events.filter((x) => x.event === "place_saved")).toHaveLength(0);
  fail = false;
  await save.click();
  await expect
    .poll(() => events.filter((x) => x.event === "place_saved").length, {
      timeout: 15000,
    })
    .toBe(1);
  expect(requests).toBe(2);
  await page
    .getByRole("button", { name: "장소 상세 닫기", exact: true })
    .click();
  if (!isMobile)
    await page
      .getByRole("button", { name: "공개 장소 상세 보기", exact: true })
      .click();
  else {
    await page.getByRole("button", { name: "목록 보기", exact: true }).click();
    await page
      .locator(".mobile-list-title")
      .filter({ hasText: "공개 장소" })
      .click();
    await page
      .getByRole("button", { name: "장소 상세 펼치기", exact: true })
      .click();
  }
  await expect
    .poll(
      () => events.filter((x) => x.event === "place_detail_opened").length,
      { timeout: 15000 },
    )
    .toBe(2);
});

test("proposal completion counts only a successful new submission and omits private form data", async ({
  page,
}) => {
  const events = await open(page);
  await page.route("**/api/places/geocode", (route) =>
    route.fulfill({ json: { lat: 37, lng: 127, label: "서울" } }),
  );
  let fail = true;
  await page.route("**/api/places/propose", (route) =>
    route.fulfill({
      status: fail ? 503 : 200,
      json: fail
        ? { error: "일시적인 저장 오류" }
        : {
            id: "44444444-4444-4444-8444-444444444444",
            placeId: "55555555-5555-4555-8555-555555555555",
            status: "pending",
            created: true,
          },
    }),
  );
  await page
    .getByRole("button", { name: "제안 화면으로", exact: true })
    .click();
  await page.getByText("찾는 장소가 없나요? 직접 등록").click();
  await page
    .getByLabel("장소 이름", { exact: true })
    .fill("SECRET_PROPOSAL_NAME");
  await page
    .getByLabel("주소", { exact: true })
    .fill("SECRET_PROPOSAL_ADDRESS");
  await page.getByRole("button", { name: "주소에서 위치 찾기" }).click();
  await page.getByRole("button", { name: "이 장소로 계속" }).click();
  await page.getByRole("button", { name: "제안 내용 확인" }).click();
  await page.getByRole("button", { name: "장소 제안하기" }).click();
  await expect(page.getByText("일시적인 저장 오류")).toBeVisible();
  expect(events.some((x) => x.event === "proposal_completed")).toBe(false);
  fail = false;
  await page.getByRole("button", { name: "장소 제안하기" }).click();
  await expect
    .poll(() => events.filter((x) => x.event === "proposal_completed").length, {
      timeout: 15000,
    })
    .toBe(1);
  expect(
    events.find((x) => x.event === "proposal_completed")!.properties,
  ).toMatchObject({
    map_id: "11111111-1111-4111-8111-111111111111",
    entry: "proposal",
  });
  for (const value of [
    "SECRET_PROPOSAL_NAME",
    "SECRET_PROPOSAL_ADDRESS",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
    "/submit",
  ])
    expect(JSON.stringify(events)).not.toContain(value);
});
