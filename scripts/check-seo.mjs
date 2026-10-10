// Read-only deployment audit; no indexing requests, credentials or DB writes.
import { chromium } from "@playwright/test";

const target = process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL;
let origin;
try {
  const url = new URL(target);
  if (url.username || url.password || url.protocol !== "https:")
    throw new Error();
  origin = url.origin;
} catch {
  console.error("사용법: npm run check:seo -- https://대표-도메인");
  process.exit(1);
}
const canonicalOrigin = new URL(process.argv[3] ?? origin).origin;
let failures = 0;
function report(ok, label, detail = "") {
  console.log(
    `${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
}
async function read(path, userAgent) {
  const response = await fetch(new URL(path, origin), {
    headers: userAgent ? { "user-agent": userAgent } : undefined,
    signal: AbortSignal.timeout(30000),
  });
  return { response, text: await response.text() };
}
const browser = await chromium.launch();
try {
  const robots = await read("/robots.txt");
  report(
    robots.response.ok &&
      /text\/plain/i.test(robots.response.headers.get("content-type") ?? ""),
    "robots.txt 응답",
    `HTTP ${robots.response.status}`,
  );
  report(!/^Disallow:\s*\/\s*$/im.test(robots.text), "전체 크롤링 차단 없음");
  report(
    robots.text.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`),
    "대표 도메인 사이트맵 안내",
  );
  const sitemap = await read("/sitemap.xml");
  report(
    sitemap.response.ok && /<urlset[\s>]/.test(sitemap.text),
    "사이트맵 XML",
    `HTTP ${sitemap.response.status}`,
  );
  const urls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  report(
    urls.length > 0 && urls.every((u) => new URL(u).origin === canonicalOrigin),
    "사이트맵 대표 도메인 일치",
    `${urls.length} URLs`,
  );
  report(new Set(urls).size === urls.length, "사이트맵 URL 중복 없음");
  const place = urls.find((u) => /\/places\/[^/]+$/.test(new URL(u).pathname));
  const directory = urls.find((u) => /\/places$/.test(new URL(u).pathname));
  const area = urls.find((u) => /\/areas\/[^/]+$/.test(new URL(u).pathname));
  report(Boolean(place && directory), "공개 장소·목록 URL 포함");
  const samples = [canonicalOrigin + "/", directory, place, area].filter(
    Boolean,
  );
  for (const userAgent of ["bingbot", "OAI-SearchBot", "PerplexityBot"]) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      userAgent,
    });
    try {
      const page = await context.newPage();
      for (const url of samples) {
        const sample = new URL(url);
        const response = await page.goto(
          origin + sample.pathname + sample.search,
          {
            waitUntil: "load",
            timeout: 45000,
          },
        );
        const label = `${userAgent} ${new URL(url).pathname}`;
        report(response?.status() === 200, `${label} 응답`);
        report(
          (await page
            .locator('head link[rel="canonical"]')
            .evaluateAll((nodes) => nodes[0]?.getAttribute("href") ?? null)) ===
            url.replace(/\/$/, ""),
          `${label} canonical`,
        );
        const directives = [
          ...(await page
            .locator('meta[name="robots"]')
            .evaluateAll((nodes) =>
              nodes.map((n) => n.getAttribute("content") ?? ""),
            )),
          response?.headers()["x-robots-tag"] ?? "",
        ].join(",");
        report(!/\b(noindex|none)\b/i.test(directives), `${label} 색인 허용`);
        const headings = await page.locator("h1").all();
        const visible = await Promise.all(
          headings.map((heading) => heading.isVisible()),
        );
        report(visible.some(Boolean), `${label} 스크립트 없이 본문 표시`);
        if (url !== canonicalOrigin + "/") {
          const schemas = await page
            .locator('script[type="application/ld+json"]')
            .allTextContents();
          report(
            schemas.length > 0 &&
              schemas.every((s) => {
                try {
                  JSON.parse(s);
                  return true;
                } catch {
                  return false;
                }
              }),
            `${label} 구조화 데이터`,
          );
        }
      }
    } finally {
      await context.close();
    }
  }
  // Missing paths must not be indexable successful pages.
  const missing = await read("/maps/seo-audit-nonexistent-map/places");
  report(missing.response.status === 404, "없는 지도는 실제 404");
} catch (error) {
  report(false, "SEO 점검 실행", error.message);
} finally {
  await browser.close();
}
console.log(
  "INFO: 이 점검은 실제 색인·검색 순위·AI 인용 또는 소유권 인증 완료를 의미하지 않습니다.",
);
process.exitCode = failures ? 1 : 0;
