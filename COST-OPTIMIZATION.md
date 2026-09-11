# API cost optimization plan

## Implemented boundaries

- Theme Map browsing, pins, votes, saves, follows, and comments use Supabase data only.
- Public map data is cached for five minutes and expires after one hour. Community mutations invalidate `public-community` immediately.
- Google Places runs only after the internal place search returns no match.
- External autocomplete requires three characters, reuses an in-memory result for repeated input in the same search session, and retains one session token through the terminating Place Details request.
- A Google session accepts at most twelve autocomplete requests and one Details request. A user is limited to thirty external requests per hour, in addition to the operator's daily, monthly, and budget limits.
- Google Places uses Autocomplete and Place Details Essentials with `id,displayName,formattedAddress,location`; it does not use Text Search Pro in the contributor flow.

## Operating controls

Set a Google Cloud Billing Budget with alerts at 50%, 80%, and 100%. Set the same daily and monthly request caps in the app's **관리 → 외부 API 사용량과 한도** screen. The app records a conservative list-price reservation before each Places call; Google Cloud Billing remains the source of truth for invoices and Maps JavaScript map-load usage.

## Scaling sequence

1. Keep public map data cached and invalidate only after a successful mutation.
2. Lazy-load Google Maps when the map viewport enters the screen; lists remain usable before a map loads.
3. Increase app request caps only after the Google Cloud billing dashboard confirms the actual monthly usage stays within budget.
4. If map loads, rather than place proposals, become the dominant cost, make list view the default on mobile and load the interactive map on explicit user intent.
