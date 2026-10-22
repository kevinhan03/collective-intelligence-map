import { expect, test, type Page } from "@playwright/test";
import { build } from "vite";
import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
let script = "",
  styles = "";
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    resolve: { alias: { "@": resolve("src") } },
    define: { "process.env.NODE_ENV": '"development"' },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve("tests/fixtures/map-markers.tsx"),
        formats: ["iife"],
        name: "MarkerRegression",
      },
    },
    logLevel: "error",
  });
  const output = Array.isArray(result)
    ? result[0].output
    : "output" in result
      ? result.output
      : [];
  script = output
    .filter((item) => item.type === "chunk")
    .map((item) => (item.type === "chunk" ? item.code : ""))
    .join("\n");
  const directory = resolve(".next-e2e/static/chunks");
  styles = readdirSync(directory)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(resolve(directory, name), "utf8"))
    .join("\n");
  styles += output
    .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
    .map((item) => (item.type === "asset" ? String(item.source) : ""))
    .join("\n");
});
async function openMarkerFixture(page: Page, labels = false, focus = false) {
  await page.route("**/marker-regression*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><main id="root" style="max-width:900px;margin:0 auto"></main></body></html>`,
    }),
  );
  await page.route("**/marker-test-style.json", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#222d35" },
          },
        ],
      },
    }),
  );
  await page.route("**/map-data/*.geojson", (route) =>
    route.fulfill({ json: { type: "FeatureCollection", features: [] } }),
  );
  await page.goto(
    `/marker-regression${focus ? "?focus" : labels ? "?labels" : ""}`,
  );
  await page.addScriptTag({ content: script });
}
test("MapLibre pins keep positioning classes and DOM identity after updates, zoom and pan", async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openMarkerFixture(page);
  const pins = page.locator(".map-marker");
  await expect(pins).toHaveCount(3);
  await expect(pins.locator(".map-recommendation-thumb")).toHaveCount(0);
  await expect(pins.first().locator(".map-marker-face")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(pins.first().locator(".map-marker-face")).toHaveCSS(
    "border-radius",
    "50%",
  );
  await expect(pins.first().locator(".map-marker-face")).toHaveCSS(
    "background-color",
    "rgb(237, 255, 112)",
  );
  await expect(pins.first()).toHaveCSS("width", isMobile ? "14px" : "16px");
  const west = page.getByRole("button", {
    name: "서쪽 장소 · 주제 추천 0",
    exact: true,
  });
  const east = page.getByRole("button", {
    name: "동쪽 장소 · 주제 추천 0",
    exact: true,
  });
  await expect(west).toHaveCSS("position", "absolute");
  await expect
    .poll(async () => {
      const a = await west.boundingBox(),
        b = await east.boundingBox();
      return a && b ? b.x - a.x : 0;
    })
    .toBeGreaterThan(30);
  const handle = await west.elementHandle();
  const anchor = await west.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.bottom };
  });
  await west.click();
  await expect(west).toHaveAttribute("data-selected", "true");
  await expect(west).toHaveCSS("width", isMobile ? "18px" : "20px");
  await expect(west.locator(".map-marker-face")).toBeEmpty();
  await expect(west.locator(".map-marker-recommendation")).toBeVisible();
  await expect(west.locator(".map-marker-recommendation")).toHaveText("0");
  await expect(west.locator(".map-marker-recommendation")).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(west.locator(".map-recommendation-thumb")).toHaveCSS(
    "background-color",
    "rgb(237, 255, 112)",
  );
  await expect(west.locator(".map-recommendation-thumb")).toHaveCSS(
    "width",
    "16px",
  );
  await expect(west.locator(".map-recommendation-thumb")).toHaveCSS(
    "mask-image",
    /hand-thumb-up-solid\.svg/,
  );
  expect((await page.request.get("/icons/hand-thumb-up-solid.svg")).ok()).toBe(
    true,
  );
  await expect(west.locator(".map-marker-recommendation")).toHaveCSS(
    "background-color",
    "rgb(21, 26, 32)",
  );
  const bubbleBox = await west
    .locator(".map-marker-recommendation")
    .boundingBox();
  const pinBox = await west.boundingBox();
  expect(bubbleBox!.y + bubbleBox!.height).toBeLessThan(pinBox!.y);
  await expect(east.locator(".map-marker-face")).toBeEmpty();
  await expect(west).toHaveClass(/maplibregl-marker-anchor-bottom/);
  await expect
    .poll(() =>
      west.evaluate((element, before) => {
        const box = element.getBoundingClientRect();
        return Math.hypot(
          box.x + box.width / 2 - before.x,
          box.bottom - before.y,
        );
      }, anchor),
    )
    .toBeLessThan(2);
  await page.getByRole("button", { name: "핀 숫자 갱신" }).click();
  const updated = page.getByRole("button", {
    name: "서쪽 장소 · 주제 추천 1",
    exact: true,
  });
  await expect(updated).toBeVisible();
  await expect(updated.locator(".map-marker-recommendation")).toHaveText("1");
  await expect(
    page.locator('.map-marker[title="동쪽 장소"] .map-marker-face'),
  ).toBeEmpty();
  expect(
    await updated.evaluate((element, original) => element === original, handle),
  ).toBe(true);
  await expect(updated).toHaveCSS("position", "absolute");
  const assertClasses = async () =>
    expect(
      await pins.evaluateAll((elements) =>
        elements.every(
          (element) =>
            element.classList.contains("maplibregl-marker") &&
            element.classList.contains("maplibregl-marker-anchor-bottom") &&
            getComputedStyle(element).position === "absolute",
        ),
      ),
    ).toBe(true);
  await assertClasses();
  const revision = page.getByLabel("지도 이동 횟수", { exact: true });
  const beforeZoom = Number(await revision.innerText());
  const oldTransform = await updated.getAttribute("style");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () => Number(await revision.innerText()))
    .toBeGreaterThan(beforeZoom);
  await expect(updated).not.toHaveAttribute("style", oldTransform!);
  await assertClasses();
  const canvas = await page.locator(".maplibregl-canvas").boundingBox();
  const beforePan = Number(await revision.innerText());
  await page.mouse.move(
    canvas!.x + canvas!.width / 2,
    canvas!.y + canvas!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas!.x + canvas!.width / 2 + 70,
    canvas!.y + canvas!.height / 2 + 45,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => Number(await revision.innerText()))
    .toBeGreaterThan(beforePan);
  await assertClasses();
  expect(
    await updated.evaluate((element, original) => element === original, handle),
  ).toBe(true);
  await page.getByRole("button", { name: "남쪽 장소 제거" }).click();
  await expect(pins).toHaveCount(2);
  await assertClasses();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `artifacts/performance/pin-regression-${testInfo.project.name}.png`,
  });
});

test("place labels follow zoom 12 and overlapping pins stay individually selectable", async ({
  page,
  isMobile,
}, testInfo) => {
  await openMarkerFixture(page, true);
  const pins = page.locator(".map-marker");
  const visible = page.locator('.map-marker[data-label-visible="true"]');
  const zoom = page.getByLabel("지도 줌", { exact: true });
  await expect
    .poll(async () => Number(await zoom.innerText()))
    .toBeGreaterThan(0);
  expect(Number(await zoom.innerText())).toBeLessThan(12);
  await expect(visible).toHaveCount(0);
  await page
    .getByRole("button", { name: "가운데 장소 선택", exact: true })
    .click();
  await expect(visible).toHaveCount(1);
  await expect(visible.locator(".map-marker-label")).toHaveText(
    "A very long English place name for truncation",
  );
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await expect(visible).toHaveCount(0);

  // The fixture derives zoom from viewport width and geographic bounds;
  // production renderer APIs remain unchanged.
  while (Number(await zoom.innerText()) < 12) {
    const before = Number(await zoom.innerText());
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect
      .poll(async () => Number(await zoom.innerText()))
      .toBeGreaterThan(before + 0.9);
  }
  await expect.poll(() => visible.count()).toBeGreaterThan(0);
  const longLabel = pins
    .filter({ hasText: "아주 긴 한글" })
    .locator(".map-marker-label");
  await expect(longLabel).toHaveCSS("font-size", isMobile ? "12px" : "10px");
  if (!isMobile) {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 709, height: viewport.height });
    await expect(longLabel).toHaveCSS("font-size", "10px");
    expect(
      await longLabel.evaluate(
        (element) =>
          parseFloat(getComputedStyle(element).top) -
          element.parentElement!.getBoundingClientRect().height,
      ),
    ).toBe(6);
    await page.setViewportSize(viewport);
  }
  await expect(longLabel).toHaveCSS("font-weight", "500");
  await expect(longLabel).toHaveCSS("text-overflow", "ellipsis");
  expect(
    await longLabel.evaluate(
      (element) =>
        element.scrollWidth > element.clientWidth && element.clientWidth <= 144,
    ),
  ).toBe(true);
  // At zoom 12 these long names compete for horizontal space.
  await expect.poll(() => visible.count()).toBeLessThan(3);
  const labels = await visible.locator(".map-marker-label").all();
  for (let a = 0; a < labels.length; a++) {
    const box = await labels[a].boundingBox();
    for (let b = a + 1; b < labels.length; b++) {
      const other = await labels[b].boundingBox();
      expect(
        box &&
          other &&
          box.x < other.x + other.width &&
          box.x + box.width > other.x &&
          box.y < other.y + other.height &&
          box.y + box.height > other.y,
      ).toBe(false);
    }
  }
  await page
    .getByRole("button", { name: "가운데 장소 선택", exact: true })
    .click();
  await expect(pins.filter({ hasText: "A very long English" })).toHaveAttribute(
    "data-label-visible",
    "true",
  );
  await page.screenshot({
    path: `/tmp/marker-labels-${testInfo.project.name}.png`,
  });

  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  const before = Number(await zoom.innerText());
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect
    .poll(async () => Number(await zoom.innerText()))
    .toBeLessThan(before - 0.9);
  await expect(visible).toHaveCount(0);
  await page
    .getByRole("button", { name: "같은 위치로 모으기", exact: true })
    .click();
  await expect(pins).toHaveCount(3);
  await expect(page.locator('.map-marker[data-cluster="true"]')).toHaveCount(0);
  await expect(visible).toHaveCount(0);
  const zoomBeforeSelection = Number(await zoom.innerText());
  await pins.last().click();
  await expect(pins.last()).toHaveAttribute("data-selected", "true");
  await expect(pins.last().locator(".map-marker-recommendation")).toHaveText(
    "0",
  );
  expect(Number(await zoom.innerText())).toBeCloseTo(zoomBeforeSelection, 2);
  await expect(visible).toHaveCount(1);
  await page
    .getByRole("button", { name: "가운데 장소 선택", exact: true })
    .click();
  await expect(pins.last().locator(".map-marker-recommendation")).toBeHidden();
  await expect(
    pins
      .filter({ hasText: "A very long English" })
      .locator(".map-marker-recommendation"),
  ).toHaveText("0");
});

test("selected pins focus at 40 percent of the screen on mobile and stay centered on desktop", async ({
  page,
  isMobile,
}, testInfo) => {
  await openMarkerFixture(page, false, true);
  await page
    .getByRole("button", { name: "서쪽 장소 · 주제 추천 0", exact: true })
    .click();
  const arrival = page.getByLabel("초점 이동 완료", { exact: true });
  await expect(arrival).toHaveText("west");
  const assertPosition = async () => {
    const pin = await page
      .locator('.map-marker[data-selected="true"]')
      .boundingBox();
    const canvas = await page.locator(".maplibregl-canvas").boundingBox();
    const actual = isMobile ? pin!.y + pin!.height / 2 : pin!.y + pin!.height;
    const expected = isMobile
      ? page.viewportSize()!.height * 0.4
      : canvas!.y + canvas!.height / 2;
    expect(Math.abs(actual - expected)).toBeLessThan(3);
    await expect(
      page.locator(
        '.map-marker[data-selected="true"] .map-marker-recommendation',
      ),
    ).toHaveCSS("height", "32px");
  };
  await assertPosition();
  await page
    .getByRole("button", { name: "동쪽 장소로 이동", exact: true })
    .click();
  await expect(arrival).toHaveText("east");
  await assertPosition();
  await page.screenshot({
    path: `/tmp/pin-focus-${testInfo.project.name}.png`,
  });
});
