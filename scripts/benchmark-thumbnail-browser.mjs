import { build } from "vite";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const oldQueue = execFileSync(
  "git",
  ["show", "f351c08:src/components/community/place-thumbnail-queue.ts"],
  { encoding: "utf8" },
);
const primitives = resolve("tests/fixtures/primitives.tsx");
const chunks = resolve(".next/static/chunks");
const css = (
  await Promise.all(
    (await fs.readdir(chunks))
      .filter((n) => n.endsWith(".css"))
      .map((n) => fs.readFile(resolve(chunks, n), "utf8")),
  )
).join("\n");
async function bundle(mode) {
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
        {
          find: "@/components/map/map-canvas",
          replacement: resolve("tests/fixtures/workflow-map.tsx"),
        },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      {
        name: "benchmark-mocks",
        resolveId(id) {
          if (id.startsWith("workflow-")) return id;
        },
        load(id) {
          if (id === "workflow-link")
            return `export {Link as default} from ${JSON.stringify(primitives)}`;
          if (id === "workflow-image")
            return `export {Image as default} from ${JSON.stringify(primitives)}`;
          if (
            mode === "before" &&
            id === resolve("src/components/community/place-thumbnail-queue.ts")
          )
            return oldQueue;
        },
      },
    ],
    define: { "process.env.NODE_ENV": '"production"' },
    build: {
      write: false,
      minify: true,
      lib: {
        entry: resolve("tests/fixtures/workflows.tsx"),
        formats: ["iife"],
        name: "Benchmark",
      },
    },
    logLevel: "error",
  });
  const output = Array.isArray(result) ? result[0].output : result.output;
  return output
    .filter((i) => i.type === "chunk")
    .map((i) => i.code)
    .join("\n");
}
const bundles = {
  before: await bundle("before"),
  after: await bundle("after"),
};
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const scenario of ["visible", "ten"])
    for (let repeat = 0; repeat < 3; repeat++)
      for (const mode of repeat % 2
        ? ["after", "before"]
        : ["before", "after"]) {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          isMobile: true,
        });
        if (scenario === "ten")
          await page.addInitScript(() => {
            window.IntersectionObserver = class {
              constructor(cb) {
                this.cb = cb;
              }
              observe(target) {
                this.cb([{ isIntersecting: true, target }]);
              }
              disconnect() {}
              unobserve() {}
            };
          });
        await page.addInitScript(() => {
          window.photoTimings = { start: null, loaded: [] };
          const observer = new MutationObserver(() => {
            if (
              window.photoTimings.start === null &&
              document.querySelector(".mobile-list-place")
            )
              window.photoTimings.start = performance.now();
          });
          observer.observe(document, { childList: true, subtree: true });
          document.addEventListener(
            "load",
            (event) => {
              if (
                event.target instanceof HTMLImageElement &&
                event.target.closest(".mobile-list-place")
              )
                window.photoTimings.loaded.push(
                  performance.now() - window.photoTimings.start,
                );
            },
            true,
          );
        });
        let metadata = 0,
          images = 0;
        const ids = new Set();
        await page.route("http://benchmark.local/**", async (route) => {
          const url = new URL(route.request().url());
          if (url.pathname === "/fixture") {
            await route.fulfill({
              contentType: "text/html",
              body: `<html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root" class="page-wrap max-w-2xl"></div></body></html>`,
            });
            return;
          }
          if (url.pathname === "/api/places/photos/previews") {
            metadata++;
            const requested = route.request().postDataJSON().placeIds;
            requested.forEach((id) => ids.add(id));
            await new Promise((r) => setTimeout(r, 120));
            await route.fulfill({
              json: {
                previews: Object.fromEntries(requested.map((id) => [id, id])),
              },
            });
            return;
          }
          if (/^\/api\/places\/[^/]+\/photos$/.test(url.pathname)) {
            metadata++;
            const id = url.pathname.split("/")[3];
            ids.add(id);
            await new Promise((r) => setTimeout(r, 120));
            await route.fulfill({ json: { photos: [{ id }] } });
            return;
          }
          if (url.pathname.startsWith("/api/photos/")) {
            images++;
            await new Promise((r) => setTimeout(r, 40));
            await route.fulfill({
              contentType: "image/svg+xml",
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76"><rect width="76" height="76" fill="green"/></svg>',
            });
            return;
          }
          await route.fulfill({ json: {} });
        });
        await page.goto(
          `http://benchmark.local/fixture?fixture=mobile-list${scenario === "ten" ? "&count=10" : ""}`,
        );
        await page.addScriptTag({ content: bundles[mode] });
        await page.waitForFunction(() => window.photoTimings.loaded.length > 0);
        await page.waitForTimeout(650);
        const timings = await page.evaluate(() => window.photoTimings);
        if (scenario === "ten") assert.equal(ids.size, 10);
        if (scenario === "ten" && mode === "after") assert.equal(metadata, 1);
        results.push({
          scenario,
          repeat,
          mode,
          metadata,
          images,
          placesRequested: ids.size,
          firstPhotoMs: Math.round(Math.min(...timings.loaded)),
          lastPhotoMs: Math.round(Math.max(...timings.loaded)),
        });
        if (scenario === "visible" && repeat === 2)
          await page.screenshot({
            path: `artifacts/performance/place-loading/mobile-${mode}.png`,
          });
        await page.close();
      }
  await fs.writeFile(
    "artifacts/performance/place-loading/browser-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
