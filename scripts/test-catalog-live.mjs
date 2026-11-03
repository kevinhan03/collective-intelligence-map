import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, expect } from "@playwright/test";
process.loadEnvFile(".env.test.local");
const base = process.env.CATALOG_TEST_BASE ?? "http://127.0.0.1:3001";
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
const status = JSON.parse(
  fs.readFileSync(".local/supabase-status.json", "utf8"),
);
for (const url of [base, api, status.DB_URL])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw Error("Catalog live tests require local services only.");
const sql = new pg.Client({ connectionString: status.DB_URL });
await sql.connect();
const service = createClient(api, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const browser = await chromium.launch();
const users = [];
const contexts = [];
const errors = [];
const backup = (await sql.query("select * from public.catalog_settings")).rows;
async function actor(role) {
  const email = `catalog-${crypto.randomUUID()}@example.com`,
    password = crypto.randomUUID();
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  const id = created.data.user.id;
  users.push(id);
  if (role === "admin")
    await sql.query(
      "insert into private.user_roles(user_id,role) values($1,'admin')",
      [id],
    );
  const cookies = [];
  const client = createServerClient(
    api,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookies,
        setAll: (values) => {
          for (const v of values) {
            const i = cookies.findIndex((c) => c.name === v.name);
            if (i < 0) cookies.push(v);
            else cookies[i] = v;
          }
        },
      },
    },
  );
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  const profile = await client.from("profiles").select("id").eq("id", id);
  if (profile.error)
    console.log("Local actor profile error", profile.error.message);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
  });
  contexts.push(context);
  await context.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: new URL(base).hostname,
      path: "/",
      sameSite: "Lax",
    })),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  return { id, context, page };
}
const post = (context, payload, origin = base) =>
  context.request.post(`${base}/api/admin/catalog`, {
    headers: { Origin: origin },
    data: payload,
  });
try {
  const admin = await actor("admin"),
    other = await actor("admin"),
    member = await actor("member");
  const anonymous = await browser.newContext();
  contexts.push(anonymous);
  assert.equal(
    (await anonymous.request.get(`${base}/api/admin/catalog`)).status(),
    401,
  );
  assert.equal(
    (await member.context.request.get(`${base}/api/admin/catalog`)).status(),
    403,
  );
  assert.equal(
    (
      await post(admin.context, { changes: [] }, "https://invalid.example")
    ).status(),
    403,
  );
  console.log(
    "PASS: authenticated admin API; anonymous/member/cross-origin denial",
  );
  const page = admin.page;
  const reactions = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/maps/engagement"))
      reactions.push(r.url());
  });
  await page.goto(`${base}/admin/catalog`);
  await expect(page.getByLabel("표시 이름", { exact: true })).toBeEnabled();
  const snapshot = await (
    await admin.context.request.get(`${base}/api/admin/catalog`)
  ).json();
  const vintage = snapshot.maps.find((m) => m.slug === "korea-vintage"),
    tokyo = snapshot.maps.find((m) => m.slug === "tokyo-fashion");
  const originalNames = (
    await sql.query(
      "select id,title from public.theme_maps where id=any($1::uuid[])",
      [[vintage.id, tokyo.id]],
    )
  ).rows;
  const runId = Date.now();
  const firstName = `브라우저 검증 빈티지 ${runId}`,
    secondName = `브라우저 검증 도쿄 ${runId}`;
  await page
    .getByRole("link", { name: "전국 빈티지숍 편집", exact: true })
    .click();
  await page.getByLabel("표시 이름", { exact: true }).fill(firstName);
  await page
    .getByRole("link", { name: "도쿄 패션 스토어 편집", exact: true })
    .click();
  await page.getByLabel("표시 이름", { exact: true }).fill(secondName);
  await expect(
    page.getByText("변경한 지도 2개", { exact: true }),
  ).toBeVisible();
  assert.ok(
    !(await (await anonymous.request.get(base)).text()).includes(firstName),
  );
  await page.reload();
  await expect(page.getByLabel("표시 이름", { exact: true })).toBeEnabled();
  await expect(
    page.getByText("변경한 지도 2개", { exact: true }),
  ).toBeVisible();
  console.log(
    "PASS: multiple-map drafts survive card selection and reload; public home remains unchanged",
  );
  // A real second administrator changes one of our batch targets.
  const tokyoSetting = snapshot.settings.find((s) => s.map_id === tokyo.id);
  const edit = {
    mapId: tokyo.id,
    version: tokyoSetting.version,
    title: "다른 관리자 변경",
    category: "fashion",
    region: "",
    aliases: tokyoSetting.value.aliases,
    imageId: null,
    focalX: 50,
    focalY: 50,
  };
  assert.equal((await post(other.context, { changes: [edit] })).status(), 200);
  await page
    .getByRole("button", { name: "변경사항 적용", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "다른 관리자가",
  );
  const before = (
    await sql.query(
      "select value from public.catalog_settings where map_id=$1",
      [vintage.id],
    )
  ).rows[0].value;
  assert.notEqual(before.title, firstName);
  await page.getByRole("button", { name: "최신 내용 확인" }).click();
  await page
    .getByRole("link", { name: `${secondName} 편집`, exact: true })
    .click();
  await page.getByRole("button", { name: "이 지도 되돌리기" }).click();
  await page.getByLabel("표시 이름", { exact: true }).fill(secondName);
  await page
    .getByRole("button", { name: "변경사항 적용", exact: true })
    .click();
  await expect(
    page.getByText("변경사항을 적용했습니다.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("표시 이름", { exact: true })).toBeEnabled();
  const html = await (await anonymous.request.get(base)).text();
  assert.ok(html.includes(firstName));
  assert.ok(
    (await (await anonymous.request.get(`${base}/discover`)).text()).includes(
      secondName,
    ),
  );
  assert.deepEqual(
    (
      await sql.query(
        "select id,title from public.theme_maps where id=any($1::uuid[]) order by id",
        [[vintage.id, tokyo.id]],
      )
    ).rows,
    originalNames.sort((a, b) => a.id.localeCompare(b.id)),
  );
  console.log(
    "PASS: actual concurrent-edit conflict rolls back the whole batch; retry applies to home/discover without changing source map titles",
  );
  await page
    .getByRole("link", { name: `${firstName} 편집`, exact: true })
    .click();
  await page.getByLabel("대표 이미지 업로드").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "5MB 이하",
  );
  const uploadPattern = "**/api/admin/catalog/images?*";
  await page.route(uploadPattern, (route) =>
    route.fulfill({ status: 503, json: { error: "사진 업로드 테스트 실패" } }),
  );
  await page
    .getByLabel("대표 이미지 업로드")
    .setInputFiles("public/korea-vintage-shop.jpg");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "사진 업로드 테스트 실패",
  );
  await page.unroute(uploadPattern);
  console.log(
    "PASS: invalid-image and upload-failure feedback preserves current image",
  );
  const uploaded = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/catalog/images?") &&
      r.request().method() === "POST",
  );
  await page
    .getByLabel("대표 이미지 업로드")
    .setInputFiles("public/korea-vintage-shop.jpg");
  const upload = await uploaded;
  assert.equal(upload.status(), 200);
  const image = (
    await sql.query(
      "select id from private.catalog_images where owner_id=$1 and state='ready' order by expires_at desc limit 1",
      [admin.id],
    )
  ).rows[0];
  await expect(
    page.getByRole("button", { name: "사진 중심 조정" }),
  ).toBeEnabled();
  assert.equal(
    (
      await anonymous.request.get(`${base}/api/catalog/images/${image.id}`)
    ).status(),
    404,
  );
  assert.equal(
    (
      await admin.context.request.get(`${base}/api/catalog/images/${image.id}`)
    ).status(),
    200,
  );
  await page.getByRole("button", { name: "사진 중심 조정" }).click();
  const sourceImage = page.getByAltText("중심을 조정할 원본 사진");
  await expect(sourceImage).toBeVisible();
  const sourceBox = await sourceImage.boundingBox();
  await sourceImage.click({
    position: { x: sourceBox.width * 0.25, y: sourceBox.height * 0.6 },
  });
  const pointerX = Number(
    await page.getByRole("slider", { name: "사진 가로 위치" }).inputValue(),
  );
  assert.ok(
    Math.abs(pointerX - 25) <= 1,
    "pointer focal position follows the clicked image quarter",
  );
  await page.getByRole("slider", { name: "사진 가로 위치" }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 35; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("slider", { name: "사진 세로 위치" }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 70; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "위치 반영" }).click();
  await page
    .getByRole("button", { name: "변경사항 적용", exact: true })
    .click();
  await expect(
    page.getByText("변경사항을 적용했습니다.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("표시 이름", { exact: true })).toBeEnabled();
  assert.equal(
    (
      await anonymous.request.get(`${base}/api/catalog/images/${image.id}`)
    ).status(),
    200,
  );
  const stored = (
    await sql.query(
      "select value from public.catalog_settings where map_id=$1",
      [vintage.id],
    )
  ).rows[0].value;
  assert.equal(stored.focalX, 35);
  assert.equal(stored.focalY, 70);
  console.log(
    "PASS: real private Storage upload, anonymous draft-image denial, keyboard focal edit and publish",
  );
  // An expired staging image is rejected without losing the draft.
  const upload2 = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/catalog/images?") &&
      r.request().method() === "POST",
  );
  await page
    .getByLabel("대표 이미지 업로드")
    .setInputFiles("public/korea-vintage-shop.jpg");
  assert.equal((await upload2).status(), 200);
  const expired = (
    await sql.query(
      "select id from private.catalog_images where owner_id=$1 and state='ready' order by expires_at desc limit 1",
      [admin.id],
    )
  ).rows[0];
  await sql.query(
    "update private.catalog_images set expires_at=now()-interval '1 second' where id=$1",
    [expired.id],
  );
  await page
    .getByRole("button", { name: "변경사항 적용", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText("만료");
  await expect(
    page.getByText("변경한 지도 1개", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "이 지도 되돌리기" }).click();
  console.log(
    "PASS: expired staging image rejects publication and preserves pending changes",
  );
  await page.getByRole("button", { name: "모바일", exact: true }).click();
  await expect(page.locator('[data-map-catalog="home"]')).toBeVisible();
  await page.getByRole("button", { name: "데스크톱", exact: true }).click();
  await page
    .getByRole("link", { name: `${firstName} 편집`, exact: true })
    .click();
  await page.getByRole("link", { name: "음식·카페", exact: true }).click();
  await expect(page.getByLabel("표시 이름", { exact: true })).toHaveValue(
    firstName,
  );
  assert.equal(new URL(page.url()).pathname, "/admin/catalog");
  await page.getByRole("link", { name: "전체", exact: true }).click();
  fs.mkdirSync("artifacts/catalog-admin", { recursive: true });
  await page.screenshot({
    path: "artifacts/catalog-admin/desktop-tested.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "카드 편집", exact: true }).click();
  await expect(page.getByLabel("표시 이름", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/catalog-admin/mobile-editor.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(reactions, []);
  await sql.query(
    "update private.user_roles set suspended=true where user_id=$1",
    [admin.id],
  );
  assert.equal(
    (await admin.context.request.get(`${base}/api/admin/catalog`)).status(),
    403,
  );
  console.log(
    "PASS: filters retain selected editor, responsive panes 320–1440px, no page errors, suspended admin denial",
  );
  await sql.query(
    "update private.user_roles set suspended=false where user_id=$1",
    [admin.id],
  );
  const blocked = await admin.context.newPage();
  blocked.on("dialog", (d) => d.accept());
  await blocked.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await blocked.goto(`${base}/admin/catalog`);
  await expect(blocked.getByLabel("표시 이름", { exact: true })).toBeEnabled();
  await blocked
    .getByLabel("표시 이름", { exact: true })
    .fill("저장소 차단 검증");
  await expect(
    blocked.getByText("임시 변경을 저장할 수 없습니다.", { exact: false }),
  ).toBeVisible();
  await blocked.close();
  await page
    .getByLabel("표시 이름", { exact: true })
    .fill("로그아웃 임시 변경");
  const draftKey = `ting:catalog-draft:${admin.id}`;
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), draftKey))
    .not.toBeNull();
  await admin.context.request.post(`${base}/auth/signout`, {
    headers: { Origin: base },
    maxRedirects: 0,
  });
  await page.goto(base);
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), draftKey))
    .toBeNull();
  console.log(
    "PASS: pointer focal selection, blocked-storage feedback and sign-out draft cleanup",
  );
} finally {
  // Only this local test database is touched; restore catalog values after assertions.
  for (const row of backup)
    await sql.query(
      "update public.catalog_settings set value=$2,version=$3,updated_at=$4,updated_by=$5 where map_id=$1",
      [row.map_id, row.value, row.version, row.updated_at, row.updated_by],
    );
  for (const context of contexts) await context.close();
  await browser.close();
  for (const id of users) await service.auth.admin.deleteUser(id);
  await sql.end();
}
