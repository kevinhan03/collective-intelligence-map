import { expect, test } from "@playwright/test";
import { demoMap, demoPlaces } from "../../src/server/demo";
import { mapSearchTitle, placePath } from "../../src/domain/seo";

for (const userAgent of [
  "Googlebot",
  "bingbot",
  "OAI-SearchBot",
  "PerplexityBot",
]) {
  test(`${userAgent} can read public content and follow links without JavaScript`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      userAgent,
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveTitle("팅맵 (Ting map) — 취향이 모이는 지도");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "팅맵",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /팅맵\(Ting map\)/,
    );
    await expect(
      page.getByRole("heading", {
        name: "팅맵 (Ting map) — 취향에 맞는 장소 찾기",
        exact: true,
      }),
    ).toBeVisible();
    const place = demoPlaces[0];
    await page.goto(`/maps/${demoMap.slug}/places`);
    const link = page.getByRole("link", { name: place.name, exact: true });
    await expect(link).toHaveAttribute(
      "href",
      placePath(demoMap.slug, place.place_id),
    );
    await link.click();
    await expect(
      page.getByRole("heading", { name: place.name, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(place.address, { exact: true })).toBeVisible();
    await expect(
      page.getByText(place.rationale, { exact: true }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `http://localhost:3000${placePath(demoMap.slug, place.place_id)}`,
    );
    const data = JSON.parse(
      (await page
        .locator('script[type="application/ld+json"]')
        .textContent()) ?? "{}",
    );
    expect(data["@graph"][0].name).toBe(place.name);
    expect(data["@graph"][0].geo.latitude).toBe(place.lat);
    expect(data["@graph"][0].aggregateRating).toBeUndefined();
    await expect(
      page.getByRole("link", { name: "지도에서 상세·사진 보기" }),
    ).toHaveAttribute("href", `/maps/${demoMap.slug}?place=${place.place_id}`);
    await context.close();
  });
}

test("demo indexing is disabled and private or invalid routes are not indexed", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("<loc>");
  for (const path of ["/login", "/saved", "/my-proposals"]) {
    const response = await request.get(path);
    expect(await response.text()).toMatch(
      /name="robots" content="noindex, follow"/,
    );
  }
  const invalid = await request.get(`/maps/${demoMap.slug}/places/not-a-place`);
  const html = await invalid.text();
  // Streaming notFound may retain HTTP 200; Next still emits a noindex directive.
  expect(html).toMatch(/name="robots" content="noindex/);
});

test("unsupported or identical regional listings do not create empty indexed pages", async ({
  request,
}) => {
  for (const suffix of [
    "areas/도쿄",
    "areas/서울-용산구",
    "areas/도쿄/page/0",
    "areas/도쿄/page/9999",
  ]) {
    const response = await request.get(`/maps/${demoMap.slug}/${suffix}`);
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('name="robots" content="noindex');
  }
});

for (const userAgent of [null, "Googlebot", "bingbot"]) {
  test(`${userAgent ?? "browser"}: missing map metadata consistently excludes indexing`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext(
      userAgent ? { userAgent, javaScriptEnabled: false } : {},
    );
    try {
      const page = await context.newPage();
      const response = await page.goto("/maps/seo-audit-nonexistent-map");
      testInfo.annotations.push({
        type: "missing-map-http-status",
        description: String(response?.status()),
      });
      console.log(
        `${userAgent ?? "browser"} missing map: HTTP ${response?.status()}`,
      );
      // The missing-map UI needs the existing streaming replacement script.
      // Bots with JS disabled are checked for metadata, not UI hydration.
      if (!userAgent) {
        await expect(
          page.getByRole("heading", { name: "아직 이곳에는 지도가 없어요." }),
        ).toBeVisible();
      }
      await expect(page).toHaveTitle("지도를 찾을 수 없어요 · 팅맵 (Ting map)");
      const directives = await page
        .locator('meta[name="robots"]')
        .evaluateAll((nodes) =>
          nodes.flatMap((node) =>
            (node.getAttribute("content") ?? "")
              .toLowerCase()
              .split(",")
              .map((value) => value.trim()),
          ),
        );
      expect(directives).toContain("noindex");
      expect(directives).not.toContain("index");
      // Inspect the complete response as well as the parsed document, including streamed tags.
      const html = await response!.text();
      const robots = [
        ...html.matchAll(
          /<meta\b[^>]*name="robots"[^>]*content="([^"]*)"[^>]*>/g,
        ),
      ].flatMap((match) => match[1].split(",").map((value) => value.trim()));
      expect(robots).toContain("noindex");
      expect(robots).not.toContain("index");
    } finally {
      await context.close();
    }
  });
}

for (const [path, title] of [
  ["/login", "로그인"],
  ["/privacy", "개인정보처리방침"],
  ["/terms", "이용약관"],
  [`/maps/${demoMap.slug}/submit`, "장소 제안"],
]) {
  test(`${path} has a distinct browser title`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(`${title} · 팅맵 (Ting map)`);
    if (path === "/login" || path.endsWith("/submit")) {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, follow",
      );
    }
  });
}

test("public map keeps its title, description, canonical and sharing metadata", async ({
  page,
}) => {
  await page.goto(`/maps/${demoMap.slug}`);
  await expect(page).toHaveTitle(
    `${mapSearchTitle(demoMap)} · 팅맵 (Ting map)`,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    demoMap.description,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `http://localhost:3000/maps/${demoMap.slug}`,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    mapSearchTitle(demoMap),
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    demoMap.description,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    `http://localhost:3000/maps/${demoMap.slug}`,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "http://localhost:3000/glass-neighborhood-og.jpg",
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    "content",
    mapSearchTitle(demoMap),
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    "http://localhost:3000/glass-neighborhood-og.jpg",
  );
});
