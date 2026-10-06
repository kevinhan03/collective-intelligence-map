import fs from "node:fs/promises";
import assert from "node:assert/strict";
import pg from "pg";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, devices } from "@playwright/test";
// Use an isolated local stack; credentials stay in ignored local files.
process.loadEnvFile(process.env.PHOTO_TEST_ENV || ".env.test.local");
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!["localhost", "127.0.0.1"].includes(new URL(api).hostname))
  throw new Error("Local Supabase only.");
const status = JSON.parse(
  await fs.readFile(
    process.env.PHOTO_TEST_STATUS || ".local/supabase-status.json",
    "utf8",
  ),
);
const sql = new pg.Client({ connectionString: status.DB_URL });
await sql.connect();
const service = createClient(api, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const anonymous = createClient(
  api,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const base = process.env.NEXT_PUBLIC_SITE_URL;
const browser = await chromium.launch();
const contexts = [];
const users = [];
const placeId = randomUUID(),
  extraMapId = randomUUID();
const name = `Photo verification ${Date.now()}`;
const errors = [];
const image = await sharp({
  create: { width: 1200, height: 800, channels: 3, background: "#3c8276" },
})
  .jpeg()
  .toBuffer();
async function actor(admin = false) {
  const email = `photo-${randomUUID()}@example.com`;
  const password = randomUUID();
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  users.push(id);
  if (admin)
    await sql.query(
      "insert into private.user_roles(user_id,role) values($1,'admin')",
      [id],
    );
  const context = await browser.newContext();
  contexts.push(context);
  const cookies = [];
  const sessionClient = createServerClient(
    api,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (values) => cookies.push(...values),
      },
    },
  );
  const session = await sessionClient.auth.signInWithPassword({
    email,
    password,
  });
  if (session.error) throw session.error;
  await context.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      url: base,
      sameSite: "Lax",
    })),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/settings/profile`);
  await page
    .getByRole("heading", { name: "나의 프로필", exact: true })
    .waitFor();
  return { context, page, id };
}
async function openPlace(page, slug = "tokyo-fashion") {
  await page.goto(`${base}/maps/${slug}?place=${placeId}`);
  await page
    .getByRole("heading", { name: "방문자 사진", exact: true })
    .waitFor();
}
try {
  const member = await actor(),
    other = await actor(),
    admin = await actor(true);
  const map = (
    await sql.query(
      "select id,country,city,bounds from public.theme_maps where slug='tokyo-fashion'",
    )
  ).rows[0];
  await sql.query(
    "insert into public.places(id,name,address,category,location,country,city,status,created_by) values($1,$2,'Local test-only address','패션',extensions.st_setsrid(extensions.st_makepoint(139.7,35.66),4326),$3,$4,'active',$5)",
    [placeId, name, map.country, map.city, member.id],
  );
  await sql.query(
    "insert into public.map_places(map_id,place_id,added_by,rationale,status) values($1,$2,$3,'Local independent photo verification venue','approved')",
    [map.id, placeId, member.id],
  );
  await sql.query(
    "insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status) values($1,$2,'Photo second theme','Local test','Local test',$3,$4,$5,'published')",
    [extraMapId, `photo-${extraMapId}`, map.country, map.city, map.bounds],
  );
  await sql.query(
    "insert into public.map_places(map_id,place_id,added_by,rationale,status) values($1,$2,$3,'Another theme for the same canonical place','approved')",
    [extraMapId, placeId, member.id],
  );
  await openPlace(member.page);
  await member.page
    .getByRole("button", { name: "사진 추가", exact: true })
    .click();
  let failedOnce = false;
  await member.page.route(`**/api/places/${placeId}/photos`, async (route) => {
    if (route.request().method() === "POST" && !failedOnce) {
      failedOnce = true;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Test transient upload failure" }),
      });
    }
    return route.continue();
  });
  await member.page
    .locator('[data-photo-dialog] input[type="file"]')
    .setInputFiles([
      { name: "first.jpg", mimeType: "image/jpeg", buffer: image },
      { name: "second.jpg", mimeType: "image/jpeg", buffer: image },
    ]);
  await member.page
    .getByLabel("first.jpg 사진 설명", { exact: true })
    .fill("First photo caption");
  await member.page
    .getByLabel("second.jpg 사진 설명", { exact: true })
    .fill("Second photo caption");
  await member.page
    .getByRole("button", { name: "사진 등록", exact: true })
    .click();
  await member.page.getByText("등록 완료", { exact: true }).waitFor();
  await member.page
    .getByRole("button", { name: "실패한 사진 다시 등록", exact: true })
    .click();
  await member.page.locator("[data-photo-dialog]").waitFor({ state: "hidden" });
  const registered = await sql.query(
    "select * from public.place_photos where place_id=$1 and status='visible' order by created_at desc",
    [placeId],
  );
  assert.equal(registered.rowCount, 2);
  console.log(
    "PASS: desktop upload, per-photo captions, partial failure and retry without duplicating successful uploads",
  );
  const photo = registered.rows[0];
  const retry = await member.context.request.post(
    `${base}/api/places/${placeId}/photos`,
    {
      headers: { Origin: base },
      multipart: {
        uploadId: photo.id,
        caption: photo.caption,
        photo: { name: "retry.jpg", mimeType: "image/jpeg", buffer: image },
      },
    },
  );
  assert.equal(retry.status(), 200);
  assert.equal(
    (
      await sql.query(
        "select count(*)::int n from public.place_photos where place_id=$1 and status='visible'",
        [placeId],
      )
    ).rows[0].n,
    2,
  );
  const publicPage = await member.context.request.get(
    `${base}/api/places/${placeId}/photos`,
  );
  assert.equal((await publicPage.json()).photos.length, 2);
  const publicFile = await anonymous.storage
    .from("place-photos")
    .download(photo.file_path);
  assert.ok(publicFile.error);
  const bytes = await member.context.request.get(
    `${base}/api/photos/${photo.id}/image`,
  );
  assert.equal(bytes.status(), 200);
  assert.match(bytes.headers()["cache-control"], /no-store/);
  assert.equal((await sharp(await bytes.body()).metadata()).exif, undefined);
  console.log(
    "PASS: real private Storage, anonymous app image access, no-store headers and EXIF-free image variants",
  );
  const bad = await member.context.request.post(
    `${base}/api/places/${placeId}/photos`,
    {
      headers: { Origin: base },
      multipart: {
        uploadId: randomUUID(),
        caption: "bad",
        photo: {
          name: "bad.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("corrupt"),
        },
      },
    },
  );
  assert.equal(bad.status(), 400);
  const origin = await member.context.request.post(
    `${base}/api/places/${placeId}/photos`,
    {
      headers: { Origin: "https://example.com" },
      multipart: { uploadId: randomUUID() },
    },
  );
  assert.equal(origin.status(), 403);
  const forbidden = await other.context.request.post(`${base}/api/community`, {
    headers: { Origin: base },
    data: { action: "delete_photo", id: photo.id },
  });
  assert.equal(forbidden.status(), 403);
  await openPlace(member.page, `photo-${extraMapId}`);
  await member.page.getByRole("button", { name: /사진 1 확대/ }).waitFor();
  console.log(
    "PASS: canonical place photos appear on a second theme; corrupt uploads, cross-origin writes and other-user deletion are denied",
  );
  const pagination = await sql.query(
    `insert into public.place_photos(id,place_id,author_id,caption,file_path,thumbnail_path,width,height,status,created_at)
    select gen_random_uuid(),$1,$2,'Pagination fixture','fixture.webp','fixture-thumb.webp',100,100,'visible','2025-01-01T00:00:00Z' from generate_series(1,21) returning id`,
    [placeId, member.id],
  );
  const firstPage = await (
    await member.context.request.get(`${base}/api/places/${placeId}/photos`)
  ).json();
  assert.equal(firstPage.photos.length, 20);
  assert.ok(firstPage.nextCursor);
  const nextPage = await (
    await member.context.request.get(
      `${base}/api/places/${placeId}/photos?cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    )
  ).json();
  assert.equal(nextPage.photos.length, 3);
  assert.equal(nextPage.nextCursor, null);
  assert.equal(
    new Set([...firstPage.photos, ...nextPage.photos].map((p) => p.id)).size,
    23,
  );
  await sql.query("delete from public.place_photos where id=any($1::uuid[])", [
    pagination.rows.map((r) => r.id),
  ]);
  const anonContext = await browser.newContext();
  contexts.push(anonContext);
  const anonPage = await anonContext.newPage();
  await openPlace(anonPage);
  const loginLink = await anonPage
    .getByRole("link", { name: "사진 추가", exact: true })
    .getAttribute("href");
  assert.ok(decodeURIComponent(loginLink).includes(`place=${placeId}`));
  const anonWrite = await anonContext.request.post(
    `${base}/api/places/${placeId}/photos`,
    { headers: { Origin: base }, multipart: { uploadId: randomUUID() } },
  );
  assert.equal(anonWrite.status(), 401);
  console.log(
    "PASS: 20-photo cursor pagination with tied timestamps; anonymous gallery/login return path and upload denial",
  );
  const mobile = await browser.newContext({
    ...devices["iPhone 13"],
    storageState: await member.context.storageState(),
  });
  contexts.push(mobile);
  const mobilePage = await mobile.newPage();
  mobilePage.on("pageerror", (e) => errors.push(e.message));
  await openPlace(mobilePage);
  await mobilePage.getByRole("button", { name: /사진 1 확대/ }).click();
  await mobilePage.keyboard.press("ArrowRight");
  assert.equal(await mobilePage.getByText("2 / 2", { exact: true }).count(), 1);
  await mobilePage.keyboard.press("Escape");
  await mobilePage.locator("[data-photo-dialog]").waitFor({ state: "hidden" });
  assert.equal(
    await mobilePage.getByRole("heading", { name, exact: true }).count(),
    1,
  );
  assert.ok(
    await mobilePage
      .getByRole("button", { name: /사진 1 확대/ })
      .evaluate((el) => el === document.activeElement),
  );
  await mobilePage
    .getByRole("button", { name: "사진 추가", exact: true })
    .click();
  await mobilePage
    .locator('[data-photo-dialog] input[type="file"]')
    .setInputFiles({
      name: "mobile.jpg",
      mimeType: "image/jpeg",
      buffer: image,
    });
  await mobilePage
    .getByLabel("mobile.jpg 사진 설명", { exact: true })
    .fill("Mobile upload caption");
  await mobilePage
    .getByRole("button", { name: "사진 등록", exact: true })
    .click();
  await mobilePage.locator("[data-photo-dialog]").waitFor({ state: "hidden" });
  await mobilePage
    .getByRole("button", { name: /사진 1 확대: Mobile upload caption/ })
    .click();
  const mobilePhoto = (
    await sql.query(
      "select id,file_path from public.place_photos where place_id=$1 and caption='Mobile upload caption'",
      [placeId],
    )
  ).rows[0];
  await mobilePage
    .locator("[data-photo-dialog]")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await mobilePage.locator("[data-photo-dialog]").waitFor({ state: "hidden" });
  assert.equal(
    (
      await member.context.request.get(
        `${base}/api/photos/${mobilePhoto.id}/image`,
      )
    ).status(),
    404,
  );
  assert.ok(
    (await service.storage.from("place-photos").download(mobilePhoto.file_path))
      .error,
  );
  await mobilePage.screenshot({ path: ".local/photo-mobile-verified.png" });
  console.log(
    "PASS: mobile upload/deletion, gallery, keyboard navigation, focus restoration and Escape preserving place detail",
  );
  await openPlace(other.page);
  await other.page.getByRole("button", { name: /사진 1 확대/ }).click();
  await other.page
    .locator("[data-photo-dialog]")
    .getByRole("button", { name: "신고", exact: true })
    .click();
  await other.page
    .getByLabel("사진 신고 사유")
    .fill("Local photo moderation test");
  await other.page
    .getByRole("button", { name: "신고 접수", exact: true })
    .click();
  await other.page.getByLabel("사진 신고 사유").waitFor({ state: "hidden" });
  await admin.page.goto(`${base}/admin/moderation`);
  const card = admin.page
    .locator("article")
    .filter({ hasText: "Local photo moderation test" });
  await card.getByRole("button", { name: "사진 숨기기", exact: true }).click();
  await admin.page
    .getByLabel("처리 근거")
    .fill("Verified photo moderation during local test");
  await admin.page
    .getByRole("button", { name: "확인하고 실행", exact: true })
    .click();
  await admin.page.getByRole("alertdialog").waitFor({ state: "hidden" });
  assert.equal(
    (
      await member.context.request.get(`${base}/api/photos/${photo.id}/image`)
    ).status(),
    404,
  );
  const adminImage = await admin.context.request.get(
    `${base}/api/photos/${photo.id}/image?admin=1`,
  );
  assert.equal(adminImage.status(), 200);
  assert.equal(
    (
      await member.context.request.get(
        `${base}/api/photos/${photo.id}/image?admin=1`,
      )
    ).status(),
    403,
  );
  const remaining = (
    await sql.query(
      "select id,file_path,thumbnail_path from public.place_photos where place_id=$1 and status='visible'",
      [placeId],
    )
  ).rows[0];
  const deleted = await member.context.request.post(`${base}/api/community`, {
    headers: { Origin: base },
    data: { action: "delete_photo", id: remaining.id },
  });
  assert.equal(deleted.status(), 200);
  assert.equal(
    (
      await member.context.request.get(
        `${base}/api/photos/${remaining.id}/image`,
      )
    ).status(),
    404,
  );
  assert.ok(
    (await service.storage.from("place-photos").download(remaining.file_path))
      .error,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: photo reporting/admin hiding, hidden image access control, owner deletion and real file removal; no browser errors",
  );
} finally {
  const rows = (
    await sql.query(
      "select id,file_path,thumbnail_path,cleanup_paths from public.place_photos where place_id=$1",
      [placeId],
    )
  ).rows;
  if (rows.length)
    await service.storage
      .from("place-photos")
      .remove([
        ...new Set(
          rows.flatMap((r) => [
            r.file_path,
            r.thumbnail_path,
            ...r.cleanup_paths,
          ]),
        ),
      ]);
  await sql.query(
    "delete from private.moderation_actions where photo_id in(select id from public.place_photos where place_id=$1)",
    [placeId],
  );
  await sql.query(
    "delete from public.reports where photo_id in(select id from public.place_photos where place_id=$1)",
    [placeId],
  );
  await sql.query("delete from public.place_photos where place_id=$1", [
    placeId,
  ]);
  await sql.query("delete from public.map_places where place_id=$1", [placeId]);
  await sql.query("delete from public.places where id=$1", [placeId]);
  await sql.query("delete from public.theme_maps where id=$1", [extraMapId]);
  for (const id of users) await service.auth.admin.deleteUser(id);
  for (const context of contexts) await context.close();
  await browser.close();
  await sql.end();
  console.log("Local verification users, places, photos and files cleaned up.");
}
