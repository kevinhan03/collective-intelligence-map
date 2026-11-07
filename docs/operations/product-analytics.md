# Product analytics

Production project: `ting-map`, Kevin Han's projects. The integration is optional;
missing public configuration leaves PostHog and Clarity unloaded. Set these in
Vercel **Production** and rebuild (Preview/Development should stay empty):

- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`: PostHog's public project token, never a personal API key.
- `NEXT_PUBLIC_POSTHOG_HOST`: ingestion URL shown by that project's installation guide.
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`: Clarity Settings → Overview project ID.

Vercel Web Analytics must also be enabled in the project dashboard. Its SDK and
Speed Insights already exist. Hobby does not include custom-event reporting;
PostHog supplies that reporting without upgrading the Vercel plan.

## What is collected

Vercel: public page views, visitors and performance. PostHog: public page views
and public button/link clicks plus community events (map/list switch, info opening, search start or
suggestion selection, place preview/detail opening, sorting). Public map IDs and approved place IDs support entity breakdowns. Never send
pending place/proposal IDs, names, search text, user IDs, email, identity calls,
form text or free-form properties. Click-only autocapture is restricted to
buttons and links; forms, editable content and explicitly private elements are
excluded. Element text and attributes are masked, and before_send additionally
reduces properties to a deliberate allowlist. Anonymous SDK identifiers are
retained; only safe DOM tag/position fields and explicit stable control names
survive. Session recording, surveys, feature flags and automatic
error/performance capture remain disabled. Anonymous IDs live in sessionStorage,
so repeat visitors across sessions are not deduplicated by PostHog.

Clarity: heatmaps and masked replay, using Microsoft's `clarity-js` engine with
explicit startup and stop rather than the auto-starting remote tag. Its upload
collector (`https://b.clarity.ms/collect`) matches this project's official
`https://www.clarity.ms/tag/<project-id>` installation configuration. If changing
projects, verify the assigned collector there; `www.clarity.ms/collect` is not
an ingestion endpoint. Text,
images and links under body are masked. Cookie storage/advertising consent is
denied. No identify calls. Only clean public URLs are recorded; query/hash URLs
and sensitive same-site referrers are skipped. Vercel/PostHog still count those
pages after removing query/hash. Next navigation and native History/popstate
stop replay before private page content is rendered. Public replay resumes
after a safe page commits. SDK chunks load one second after navigation and
failures do not block the application.

Allowed routes: home, discover, privacy, terms and map landing pages, with
optional ko/en prefix. Nested submission/edit routes, studio, account,
authentication, saved pages and APIs are excluded. Keep this allowlist in
`src/lib/telemetry-policy.ts` when adding routes.

## Verification and operation

1. Run `npm run check` and `npm run test:e2e`.
2. Deploy a build containing the production public configuration.
3. Visit home and a map, switch map/list and open a place. Verify page views in
   Vercel, `$pageview`/community events in PostHog Live events and incoming data
   in Clarity. Dashboard processing can lag.
4. Check the browser network: PostHog ingestion and Clarity `/collect` should
   succeed. Downloaded image/map requests are unrelated to analytics.
5. Navigate to login, saved and studio; verify no new usage events or private
   page recording. Also check direct private entry, back/forward, query URLs
   and navigation while the SDK is still loading.

Remove either provider's public configuration and redeploy to disable it.
Keep dashboard retention, masking and any required consent configuration
aligned with the published privacy notice before changing this scope.


## Hybrid click and outcome reporting

`$autocapture` is an attempted button/link click. `place_detail_opened` is emitted
once when an approved place detail is selected, across desktop/mobile/deep links.
Closing and reopening counts again; an asynchronous map focus callback or count
refresh does not duplicate it. `place_saved`/`map_saved` (and corresponding
unsaved events) are emitted only after a successful response, never on an
optimistic update or failed request. New public-map proposals queue
`proposal_completed` after successful creation; the event is flushed only on
the matching public destination within 60 seconds. No pending place ID or
proposal content is attached, and creator/studio proposals are excluded.

Stable control IDs live in `data-analytics-id` and the matching PostHog custom
capture attribute. Public entities use `map_id` and canonical `place_id`.
`analyticsControl` marks pending/non-approved place content private. A capture
phase source-page snapshot prevents a private-page click from being relabeled
as public when its handler navigates home. Early manual events are bounded to
50 entries and 60 seconds, discarded on a different destination. Explicit
outcomes and automatic clicks are separate events: never sum both as conversions.

### Operator dashboard

Use Production in Vercel. In PostHog use Current URL containing the canonical
production origin and exclude localhost. The [팅맵 이용 분석 dashboard](https://us.posthog.com/project/715915/dashboard/2316729) contains public page views and button clicks. Additional useful panels:

- Map views: `$pageview`, breakdown by Current URL (map landing pages).
- Place detail opens: `place_detail_opened`, breakdown by `map_id` / `place_id`.
- Confirmed saves: `place_saved`, breakdown by `map_id` / `place_id`.
- Detail → save funnel: `place_detail_opened` then `place_saved`, holding
  `map_id` and `place_id` constant; use same-session attribution. Anonymous
  IDs are session-scoped, so this is not a cross-session retention measure.
- Search/sort/view controls: their explicit community events; general UI
  exploration: `$autocapture`, breakdown by `control`.
- New proposals: `proposal_completed`, breakdown by `map_id`.

Run `npm run test:analytics` for real-SDK browser tests with intercepted
collection endpoints, in addition to the normal unit/E2E suite. These tests
send no data to the real analytics projects.
