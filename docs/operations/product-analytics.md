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
and aggregate community events (map/list switch, info opening, search start or
suggestion selection, place preview/detail opening, sorting). No search text,
place IDs, user IDs, email, identity calls, form text or free-form properties.
PostHog autocapture, session recording, surveys, feature flags and automatic
error/performance capture are disabled. Anonymous IDs live in sessionStorage,
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
