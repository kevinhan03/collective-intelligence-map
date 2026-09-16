# Local development and release operations

## Keyless preview

`npm ci && npm run dev`, then http://localhost:3000. Without Supabase env, a clearly marked fictional dataset demonstrates the interface. Writes/auth are disabled. Production seed contains only Tokyo Fashion, no fictional places or social proof.

## Supabase

1. Start Docker (Docker Desktop or a project-specific Colima VM), then `npx supabase start`.
2. Copy `.env.example` to `.env.local`. Set local Supabase URL, publishable key and server secret from `npx supabase status`. Do not commit keys or paste them into logs.
3. Apply migrations to a fresh local stack (`start` does so on first startup); for an isolated disposable local reset use `npx supabase db reset --local`. Never use the reset command against remote data.
4. Auth site URL and allowed redirects must include the exact local origin and `/auth/callback`; on Vercel use the exact HTTPS production/preview origin. For magic-link email configure the template to use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` if PKCE code link is not used. The login screen also accepts `{{ .Token }}` email codes, which avoid mail security scanners consuming a one-time link.
5. Enable Google OAuth in Supabase and set its provider credentials to test social login. Email is the default path. Local emails appear in Mailpit.
6. Grant first administrator after that person signs in: `insert into private.user_roles(user_id,role) values ('AUTH_USER_UUID','admin') on conflict(user_id) do update set role='admin', suspended=false;`. This is a trusted operator SQL action, not self-service profile editing. Use `contributor` for invited contributors.
7. Seed actual venues through the proposal/approval flow with independent field sources. Do not import fictional preview fixtures or copy external Places payloads.
8. Storage bucket `avatars`: public download, per-user insert/delete, JPG/PNG/WebP <=2 MB. Account deletion requires deleting owned objects and revoking sessions before removing auth identity. Contributions keep nullable authors to preserve community history.

## Provider rollout

Read `provider-policies.md`. Add REST secrets and separate restricted renderer keys to `.env.local`/Vercel environment. Generate `PROVIDER_SIGNING_SECRET`. Environment switches default false. Administrator must also enable database settings at `/admin/usage`. Verify the actual contracts and limits before enabling paid calls. Korea uses Kakao, non-Korea Google; public seed remains Tokyo only.

## Moderation

`/admin/moderation`: review pending proposals with field provenance and topic rationale. Approval publishes pins. Rejection leaves an audit record. Disputed entries remain public and should be reviewed. Archive removes them from browsing. Reports do not automatically remove content. Merges require a concrete confirmation and reason; source becomes a redirect record, destination keeps newest vote per user, union of saves and all comments. Audit history is append-only through the application. A mistaken merge requires operator recovery from the audit/backups; there is no automated unmerge.

## Verification

- `npm audit --omit=dev`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- `npm run test:e2e`: keyless desktop/mobile flow; Playwright requires `npx playwright install chromium`.
- `npm run test:db`: isolated local PostgreSQL/PostGIS database named `*_test`; `TEST_DATABASE_URL` override. Script drops/recreates application schemas in that test database only. Auth/Storage schemas are a test harness; it does not claim to verify real GoTrue/Storage service behavior.
- Live Supabase auth/E2E needs the local stack and local test env; keep test credentials isolated.
- `npm run start`: production build smoke check. Vercel uses standard Next.js build detection; configure env at build time and runtime.

## Observability / maintenance

Structured `product_event` application logs cover map reads, internal hit counts, external fallback and community actions. These are initial instrumentation, not deduplicated MAU/retention reports. Server-side RSC rendering can emit repeated map-view events; do not interpret raw counts as unique visits. Use Vercel logs for failures. Provider usage is persisted atomically with status and estimated cost. Set a retention job before production: keep only the operationally necessary duration, remove expired provider sessions/write windows, and aggregate usage before deleting events needed for monthly caps.

## Release gates

Local implementation is not a public launch. Before public release: configure Supabase/renderer/provider keys, validate real email and OAuth callbacks, review external policies/attribution, populate independently verified seed venues, finalize legal operator/contact/retention/export/deletion procedures, restrict API keys, set real platform quotas, test backup/recovery and verify deployed auth origin. Existing MVP terms/privacy pages are explicitly marked drafts.

## Verified local service stack

The project-specific Colima VM `cim` runs Supabase Auth, PostgreSQL/PostGIS, REST, Storage, Mailpit and metadata. `npm run local:setup` reads local status and creates `.env.test.local` without changing remote `.env.local`. `npm run dev:local` starts the real local application. `npm run test:live` verifies three separate user sessions, profile editing, Storage upload, proposal, admin approval, votes, private saves, comments, follows, reports and zero Places usage. It creates clearly named E2E venues in the local database only.

For a local production smoke test, use `npm run build:local` followed by `npm run start:local`. Do not run a build compiled with remote public keys against a different local runtime: Next.js inlines public keys at build time. Rebuild when changing environments.

## Deployment preflight

`npm run check:deployment` checks configured credentials by presence only, signing-key length, public DB reads and the Auth settings endpoint. It never sends email, writes DB data or calls paid Places APIs. `npm run check:deployment -- --production` also requires a non-local HTTPS site URL and the Tokyo Google renderer key. Set `GOOGLE_AUTH_ENABLED=true` only after enabling the provider in Supabase and testing its callback; the Google login button is hidden by default. The preflight fails if that UI switch is enabled while the provider is disabled.

Vercel source uploads explicitly exclude `.env*`, `.local` databases and generated artifacts via `.vercelignore`. Add application variables through Vercel environment settings; do not upload `.env.local` as source. Keep Places enable switches false until both policy review and DB usage caps are ready.

The connected Vercel team is `kevin-hans-projects-19b3e9d2`. No Collective Intelligence Map project existed at the latest check. CLI authentication was invalid; run `npx vercel login` before linking this directory to a new `collective-intelligence-map` project. Existing `size-picker` and `room-service` projects are unrelated and must not be used.
