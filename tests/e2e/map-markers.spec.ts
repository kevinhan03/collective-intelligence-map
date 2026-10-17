import { expect, test } from "@playwright/test";
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
test("MapLibre pins keep positioning classes and DOM identity after updates, zoom and pan", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/marker-regression", (route) =>
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
  await page.goto("/marker-regression");
  await page.addScriptTag({ content: script });
  const pins = page.locator(".map-marker");
  await expect(pins).toHaveCount(3);
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
