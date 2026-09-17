import { existsSync } from "node:fs";

// Read-only checks. Never print credentials or provider payloads.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
let failures = 0;
function report(ok, name, detail) {
  console.log(
    `${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
}
const env = process.env;
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "PROVIDER_SIGNING_SECRET",
]) {
  report(Boolean(env[key]), key);
}
report(
  (env.PROVIDER_SIGNING_SECRET?.length ?? 0) >= 32,
  "후보 서명 키 길이",
  "32자 이상 필요",
);
let site;
try {
  site = new URL(env.NEXT_PUBLIC_SITE_URL);
} catch {
  /* reported below */
}
report(
  Boolean(site && ["http:", "https:"].includes(site.protocol)),
  "사이트 URL",
);
if (process.argv.includes("--production")) {
  report(
    Boolean(
      site &&
      site.protocol === "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(site.hostname),
    ),
    "배포용 HTTPS 사이트 URL",
  );
  report(Boolean(env.NEXT_PUBLIC_GOOGLE_MAPS_KEY), "Tokyo 지도 렌더링 키");
}
console.log(
  `INFO: Google 지도 키 ${env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? "설정됨" : "미설정"}`,
);
if (env.GOOGLE_PLACES_ENABLED === "true")
  report(Boolean(env.GOOGLE_PLACES_API_KEY), "GOOGLE_PLACES_ENABLED에 필요한 서버 키");
else console.log("INFO: GOOGLE_PLACES_ENABLED 비활성 — 외부 검색 없이 내부 DB 사용");
if (env.KAKAO_PLACES_ENABLED === "true")
  report(
    Boolean(env.KAKAO_REST_API_KEY ?? env.KAKAO_LOCAL_API_KEY),
    "KAKAO_PLACES_ENABLED에 필요한 서버 키",
  );
else console.log("INFO: KAKAO_PLACES_ENABLED 비활성 — 외부 검색 없이 내부 DB 사용");
let base;
try {
  base = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
} catch {
  /* reported below */
}
if (base && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  const paths = [
    ["Theme Map 공개 조회", "/rest/v1/theme_maps?select=id&limit=1"],
    ["장소 카드 공개 조회", "/rest/v1/map_place_cards?select=id&limit=1"],
    ["Auth 설정", "/auth/v1/settings"],
  ];
  const results = await Promise.allSettled(
    paths.map(async ([name, path]) => {
      const response = await fetch(new URL(path, base), {
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      report(response.ok, name, `HTTP ${response.status}`);
      if (response.ok && path === "/auth/v1/settings") {
        const settings = await response.json();
        report(settings.external?.email === true, "이메일 로그인 활성화");
        if (env.GOOGLE_AUTH_ENABLED === "true") {
          report(settings.external?.google === true, "Google 로그인 UI와 공급자 설정 일치");
        }
        console.log(
          `INFO: Google OAuth ${settings.external?.google ? "활성" : "비활성 — 공급자 설정 필요"}`,
        );
      }
    }),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected")
      report(false, paths[index][0], "연결 실패 또는 시간 초과");
  });
}
console.log(
  "INFO: 이 검사는 이메일 수신, OAuth 왕복, 지도 SDK, RLS 전체 검증을 대신하지 않습니다.",
);
process.exitCode = failures ? 1 : 0;
