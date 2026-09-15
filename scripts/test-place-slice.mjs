import fs from "node:fs/promises";
import pg from "pg";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "@playwright/test";
process.loadEnvFile(".env.test.local");
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!["localhost", "127.0.0.1"].includes(new URL(api).hostname))
  throw new Error("Local Supabase only");
const status = JSON.parse(
  await fs.readFile(".local/supabase-status.json", "utf8"),
);
if (!["localhost", "127.0.0.1"].includes(new URL(status.DB_URL).hostname))
  throw new Error("Local DB only");
const sql = new pg.Client({ connectionString: status.DB_URL });
await sql.connect();
const service = createClient(api, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const base = "http://127.0.0.1:3200";
const map = crypto.randomUUID(),
  map2 = crypto.randomUUID(),
  source = crypto.randomUUID(),
  slug = `slice-${map}`;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let user;
try {
  await sql.query(
    `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status) values($1,$2,'Slice Tokyo','Local integration fixture','Vintage places','JP','Tokyo','{"west":139.6,"east":139.8,"south":35.6,"north":35.8}','published'),($3,$4,'Slice Tokyo 2','Local integration fixture','Vintage places','JP','Tokyo','{"west":139.6,"east":139.8,"south":35.6,"north":35.8}','published')`,
    [map, slug, map2, slug + "-2"],
  );
  await sql.query(
    `insert into public.our_search_places(source,source_id,primary_name,country_code,locality,address,latitude,longitude,category,search_text,release) values('overture',$1,'Slice Vintage Fixture','JP','Tokyo','Synthetic address',35.66,139.7,'vintage','Slice Vintage Fixture','test')`,
    [source],
  );
  const email = `slice-${map}@example.com`;
  const created = await service.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (created.error) throw created.error;
  user = created.data.user.id;
  const link = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error) throw link.error;
  const cookies = [];
  const authClient = createServerClient(
    api,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (values) => cookies.push(...values),
      },
    },
  );
  const verified = await authClient.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error) throw verified.error;
  await context.addCookies(
    cookies.map(({ name, value }) => ({
      name,
      value,
      url: base,
      sameSite: "Lax",
    })),
  );
  await page.goto(`${base}/maps/${slug}/submit`);
  await page
    .getByRole("textbox", { name: "제안할 장소 검색" })
    .fill("Slice Vintage");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  const external = page
    .getByRole("button")
    .filter({ hasText: "Slice Vintage Fixture" });
  await external.waitFor();
  assert.equal(
    Number(
      (
        await sql.query(
          "select count(*) from private.place_provider_refs where provider='overture' and external_id=$1",
          [source],
        )
      ).rows[0].count,
    ),
    0,
  );
  await external.click();
  await page.getByText("선택한 장소: Slice Vintage Fixture").waitFor();
  await page
    .getByLabel("추천하는 점 한 줄")
    .fill("테스트용 빈티지 장소 추천 근거입니다.");
  await page
    .getByRole("button", { name: "장소 제안하기", exact: true })
    .click();
  await page.waitForURL(`**/maps/${slug}?submitted=1`);
  await page
    .getByRole("button", {
      name: "Slice Vintage Fixture · 검토 대기",
      exact: true,
    })
    .waitFor({ timeout: 20000 });
  const canvas = page.locator(".maplibregl-canvas");
  const canvasBox = await canvas.boundingBox();
  assert(canvasBox && canvasBox.height >= 400);
  await page
    .getByRole("button", {
      name: "Slice Vintage Fixture · 검토 대기",
      exact: true,
    })
    .click();
  await page.getByRole("region", { name: "승인 대기 장소" }).waitFor();
  await page.screenshot({ path: "/tmp/cim-place-slice.png", fullPage: true });
  const first = (
    await sql.query(
      "select p.id,p.source_type,mp.status from public.map_places mp join public.places p on p.id=mp.place_id where mp.map_id=$1",
      [map],
    )
  ).rows[0];
  assert.equal(first.source_type, "overture");
  assert.equal(first.status, "pending");
  await page.goto(`${base}/maps/${slug}-2/submit`);
  await page
    .getByRole("textbox", { name: "제안할 장소 검색" })
    .fill("Slice Vintage");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "커뮤니티 장소" }).click();
  await page.getByText("이미 등록된 장소입니다").waitFor();
  await page.getByRole("button", { name: "계속 검색" }).click();
  await page.goto(`${base}/maps/${slug}/submit`);
  await page
    .getByRole("button", { name: "찾는 장소가 없나요? 새 장소 직접 등록" })
    .click();
  await page
    .getByLabel("장소 이름", { exact: true })
    .fill("Independent Slice Fixture");
  await page.getByLabel("위도", { exact: true }).fill("35.67");
  await page.getByLabel("경도", { exact: true }).fill("139.72");
  await page.getByLabel("분류", { exact: true }).fill("빈티지");
  await page
    .getByLabel("추천하는 점 한 줄")
    .fill("직접 알고 있는 장소를 등록하는 테스트입니다.");
  await page
    .getByRole("button", { name: "장소 제안하기", exact: true })
    .click();
  await page.waitForURL(`**/maps/${slug}?submitted=1`);
  await page
    .getByRole("button", {
      name: "Independent Slice Fixture · 검토 대기",
      exact: true,
    })
    .waitFor();
  const manual = (
    await sql.query(
      "select source_type from public.places where name='Independent Slice Fixture' and created_by=$1",
      [user],
    )
  ).rows[0];
  assert.equal(manual.source_type, "user");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real login → internal-first Overture search → selection → atomic place/link → MapLibre pending pin; second-map reuse; manual registration → pin; no browser errors",
  );
} catch (error) {
  console.error(
    "Browser state:",
    (await page.locator("body").innerText()).slice(-2500),
  );
  throw error;
} finally {
  await browser.close();
  // Only this run's UUID-scoped fixtures are removed.
  const ids = (
    await sql.query(
      "select place_id from public.map_places where map_id=any($1::uuid[])",
      [[map, map2]],
    )
  ).rows.map((r) => r.place_id);
  await sql.query(
    "delete from private.place_provider_refs where place_id=any($1::uuid[])",
    [ids],
  );
  await sql.query(
    "delete from private.place_field_sources where place_id=any($1::uuid[])",
    [ids],
  );
  await sql.query(
    "delete from public.map_places where map_id=any($1::uuid[])",
    [[map, map2]],
  );
  await sql.query("delete from public.places where id=any($1::uuid[])", [ids]);
  await sql.query("delete from public.theme_maps where id=any($1::uuid[])", [
    [map, map2],
  ]);
  await sql.query(
    "delete from public.our_search_places where source='overture' and source_id=$1",
    [source],
  );
  if (user) await service.auth.admin.deleteUser(user);
  await sql.end();
}
