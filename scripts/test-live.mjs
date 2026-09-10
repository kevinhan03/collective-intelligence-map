import fs from "node:fs/promises";
import assert from "node:assert/strict";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
process.loadEnvFile(".env.test.local");
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!["localhost", "127.0.0.1"].includes(new URL(api).hostname))
  throw new Error("Live test only runs against a local Supabase stack.");
const status = JSON.parse(
  await fs.readFile(".local/supabase-status.json", "utf8"),
);
const sql = new pg.Client({ connectionString: status.DB_URL });
await sql.connect();
const service = createClient(api, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const browser = await chromium.launch();
const contexts = [];
const base = "http://127.0.0.1:3000";
const stamp = Date.now();
async function actor(role, suffix) {
  const email = `cim-${stamp}-${suffix}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;
  await sql.query(
    "insert into private.user_roles(user_id,role) values($1,$2)",
    [data.user.id, role],
  );
  const { data: link, error: linkError } =
    await service.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw linkError;
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${base}/auth/callback?token_hash=${link.properties.hashed_token}`,
  );
  await page.waitForURL("**/settings/profile");
  assert.equal(
    await page.getByRole("heading", { name: "나의 프로필" }).count(),
    1,
  );
  return { page, context, id: data.user.id, errors };
}
try {
  const a = await actor("contributor", "a"),
    b = await actor("contributor", "b"),
    admin = await actor("admin", "admin");
  console.log(
    "PASS: real Supabase magic-link exchange and SSR sessions for three actors",
  );
  await a.page
    .getByLabel("사용자 이름", { exact: true })
    .fill(`curator_${stamp}`);
  await a.page
    .getByLabel("소개", { exact: true })
    .fill("독립 패션 공간을 함께 발견합니다.");
  await a.page
    .getByLabel("프로필 이미지", { exact: true })
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4ZcAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await a.page
    .getByRole("button", { name: "프로필 저장", exact: true })
    .click();
  await a.page.getByText("프로필을 저장했습니다.", { exact: true }).waitFor();
  await a.page.getByRole("link", { name: "공개 프로필 보기" }).click();
  await a.page.getByRole("img", { name: `curator_${stamp} 프로필` }).waitFor();
  console.log("PASS: profile edit and actual Supabase Storage avatar upload");

  const venue = `E2E Archive ${stamp}`;
  await a.page.goto(`${base}/maps/tokyo-fashion/submit`);
  await a.page
    .getByRole("button", { name: "직접 알고 있는 장소 입력하기" })
    .click();
  await a.page.getByLabel("장소 이름", { exact: true }).fill(venue);
  await a.page
    .getByLabel("주소", { exact: true })
    .fill("Tokyo test-only independent address");
  await a.page.getByLabel("위도", { exact: true }).fill("35.66");
  await a.page.getByLabel("경도", { exact: true }).fill("139.70");
  await a.page
    .getByLabel("이름·주소·좌표의 출처")
    .fill(
      "로컬 통합 테스트가 독립적으로 생성한 가상 이름·주소·좌표입니다. 외부 데이터가 아닙니다.",
    );
  await a.page
    .getByLabel("추천 근거", { exact: true })
    .fill(
      "로컬 통합 검증용 장소입니다. 독립 패션 컬렉션이라는 주제와 연결되는 추천 근거입니다.",
    );
  await a.page.getByRole("button", { name: "운영자에게 검토 요청" }).click();
  await a.page
    .getByRole("heading", { name: "새로운 발견을 남겼어요." })
    .waitFor();
  const anon = await browser.newContext();
  contexts.push(anon);
  const anonPage = await anon.newPage();
  await anonPage.goto(`${base}/maps/tokyo-fashion`);
  assert.equal(
    await anonPage.getByRole("button", { name: venue, exact: true }).count(),
    0,
  );
  await admin.page.goto(`${base}/admin/moderation`);
  const card = admin.page
    .locator("article")
    .filter({
      has: admin.page.getByRole("heading", { name: venue, exact: true }),
    });
  await card.getByRole("button", { name: "승인", exact: true }).click();
  await admin.page
    .getByLabel("처리 근거")
    .fill("로컬 테스트 출처와 추천 근거를 확인했습니다.");
  await admin.page.getByRole("button", { name: "확인하고 실행" }).click();
  await admin.page.getByRole("alertdialog").waitFor({ state: "hidden" });
  console.log(
    "PASS: contributor proposal, pending privacy, admin approval through real UI",
  );
  await b.page.goto(`${base}/maps/tokyo-fashion`);
  await b.page.getByRole("button", { name: venue, exact: true }).click();
  await b.page.getByRole("button", { name: "적합해요 0" }).click();
  await b.page.getByRole("button", { name: "적합해요 1" }).waitFor();
  await b.page.getByRole("button", { name: "저장", exact: true }).click();
  await b.page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
  await b.page
    .getByRole("textbox", { name: "댓글", exact: true })
    .fill("테스트 방문 경험을 더해 주제 적합성을 확인했습니다.");
  await b.page.getByRole("button", { name: "댓글 남기기" }).click();
  await b.page
    .getByText("테스트 방문 경험을 더해 주제 적합성을 확인했습니다.", {
      exact: true,
    })
    .waitFor();
  await b.page
    .getByRole("button", { name: "신고", exact: true })
    .first()
    .click();
  await b.page
    .getByLabel("신고 사유")
    .fill("로컬 통합 테스트: 위치를 다시 검토해 주세요.");
  await b.page.getByRole("button", { name: "신고 접수" }).click();
  await b.page.getByLabel("신고 사유").waitFor({ state: "hidden" });
  await b.page.keyboard.press("Escape");
  await b.page.getByRole("button", { name: "팔로우", exact: true }).click();
  await b.page
    .getByRole("button", { name: "팔로우 중", exact: true })
    .waitFor();
  await b.page.goto(`${base}/saved`);
  await b.page.getByRole("heading", { name: venue, exact: true }).waitFor();
  const aSaves = await a.context.request.get(`${api}/rest/v1/saves`);
  assert.ok(aSaves.status() >= 400); // no browser API key supplied: gateway refuses.
  await a.page.goto(`${base}/saved`);
  assert.equal(
    await a.page.getByRole("heading", { name: venue, exact: true }).count(),
    0,
  );
  console.log(
    "PASS: real vote, save, private saved list, comment, follow and report",
  );
  await admin.page.reload();
  await admin.page.goto(`${base}/admin/moderation`);
  const report = admin.page
    .locator("article")
    .filter({ hasText: "로컬 통합 테스트: 위치를 다시 검토해 주세요." });
  await report.getByRole("button", { name: "처리 완료" }).click();
  await admin.page
    .getByLabel("처리 근거")
    .fill("로컬 통합 테스트 신고 검토를 마쳤습니다.");
  await admin.page.getByRole("button", { name: "확인하고 실행" }).click();
  await admin.page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await admin.page.goto(`${base}/admin/usage`);
  await admin.page
    .getByRole("heading", { name: "외부 API 사용량과 한도" })
    .waitFor();
  const {
    rows: [count],
  } = await sql.query(
    "select count(*)::int n from private.provider_usage_events",
  );
  assert.equal(count.n, 0);
  for (const actor of [a, b, admin]) assert.deepEqual(actor.errors, []);
  await b.page.screenshot({ path: "artifacts/live-saved.png", fullPage: true });
  await admin.page.screenshot({
    path: "artifacts/live-usage.png",
    fullPage: true,
  });
  console.log(
    "PASS: report resolution, usage console, zero external Places calls, no browser errors",
  );
} catch (e) {
  for (let i = 0; i < contexts.length; i++) {
    const page = contexts[i].pages()[0];
    if (page)
      await page
        .screenshot({ path: `artifacts/live-failure-${i}.png`, fullPage: true })
        .catch(() => {});
  }
  throw e;
} finally {
  await browser.close();
  await sql.end();
}
