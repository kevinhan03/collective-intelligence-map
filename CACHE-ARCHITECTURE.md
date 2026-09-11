# Public cache and personalization

Cache Components is enabled. Home and published map slugs are partially
prerendered. Public Supabase reads use a new anonymous client without cookies
or service credentials; RLS remains authoritative. Private reads (`getViewer`,
`getMyState`, administrator/profile/saved queries) are never shared-cached.

Public map and place reads revalidate after 60 seconds and expire after 300;
comments revalidate after 15 and expire after 60. Successful community and
proposal writes immediately expire the `public-community` tag. A deliberately
broad tag also covers merges and comment moderation whose affected map IDs
are not returned by existing RPCs. Direct SQL changes converge through TTL.

The map shell renders without waiting for viewer data. A Suspense subtree
streams viewer state into its keyed client provider without replacing the map
canvas. Until resolved, participation controls have anonymous permissions;
all mutations still enforce server authorization. Protected routes retain
`instant = false` during incremental migration.

The old server `map_view` event was removed from prerendered rendering to avoid
counting builds/cache refreshes as visits. Vercel Analytics records page views.
PPR is not a claim that every request has zero backend work: authentication,
cache misses, revalidation and private requests still execute on the server.

Checks: production build must mark `/` and existing `/maps/*` as partial
prerenders; run unit tests and desktop/mobile E2E. After deployment inspect
public routes and compare `x-vercel-cache` across repeated requests. Real
authenticated mutation smoke testing requires a signed-in tester session.
