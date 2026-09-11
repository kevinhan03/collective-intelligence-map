# Observability

The root layout loads Vercel Web Analytics and Speed Insights. Enable both
features in the Vercel project dashboard, then deploy this revision. Confirm
page views in Analytics and real-user measurements in Speed Insights after
visiting a public Theme Map. SDK installation alone does not verify ingestion.

Telemetry removes URL query strings/fragments and excludes authentication,
profile, saved-place, settings and administrator pages. No search text or
contribution content is intentionally sent. Session replay is not installed.

Next.js server errors produce structured `request_error` runtime logs with
the route template, method, error type and digest, without request headers or
bodies. Existing `product_event` logs remain available in Vercel runtime logs;
they are not an external conversion dashboard. Provider usage and budgets
remain available at `/admin/usage`.

Sentry/PostHog are not connected. They require a project and configuration;
do not interpret these SDK additions as verified external error tracking.

Outstanding follow-up: country-wide maps currently use `city=Korea`. Replace
city-equality place matching with an explicit geographic scope before adding
overlapping Korean city maps, so the same internal place can be reused.
