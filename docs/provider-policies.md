# Provider policy boundary

Reviewed 2026-09-10. This file records implementation boundaries, not a legal determination.

| Provider       | Official references                                                                                       | Current implementation                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google         | https://developers.google.com/maps/documentation/places/web-service/policies                              | Place ID only persists. Search predictions/details are response-local, `no-store`. No copied names, coordinates, reviews, photos, ratings or hours in canonical tables. Google results are text-only with Google Maps attribution; no foreign renderer overlay. |
| Google pricing | https://developers.google.com/maps/documentation/places/web-service/session-pricing                       | Unique user/map-bound 15-minute session, at most 20 requests. End once with Details `id,location`, not IDs Only. Do not reuse ended tokens. Abandoned sessions remain chargeable.                                                                               |
| Google fields  | https://developers.google.com/maps/documentation/places/web-service/place-details                         | Details mask `id,location`; no `displayName`/reviews/photos. Search text is transient. Reservation estimates intentionally conservative, not a current price quote.                                                                                             |
| Kakao          | https://developers.kakao.com/docs/ko/local/dev-guide and https://developers.kakao.com/terms/ko/site-terms | REST header auth, keyword search with city rectangle. No details-by-ID call exists in this adapter. No response caching. ID retention disabled unless operator sets `KAKAO_REF_STORAGE_ALLOWED=true` after confirming applicable permission.                    |

`src/server/places/policies` records machine-readable rules. Persistent writes use explicit independent fields, not candidate spread/response JSON. A signed candidate includes identifier, actor, map, session and expiry only. The client must separately enter independently sourced canonical fields; checking a box on an external result does not convert it into first-party data. Approval records operator review of provenance.

Operator must verify current contract, display/logo requirements, map renderer compatibility, API price/SKU and ID retention rights before enabling each provider. Re-review when contract/API changes; do not assume a generic cache TTL is permitted. Cache is currently disabled for all external content. Rendering adapters are replaceable only when their displayed data's license permits it.

## Keys

- `GOOGLE_PLACES_API_KEY`, `KAKAO_LOCAL_API_KEY`: REST server secrets. API-restrict; add supported server origin/network restrictions appropriate to Vercel egress. Never put these in `NEXT_PUBLIC_*`.
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_KAKAO_MAPS_KEY`: intentionally browser-visible renderer keys. Domain/API restrict separately. No Places browser library is loaded.
- `SUPABASE_SECRET_KEY`: server budget/verified resolver only; general user actions use their authenticated Supabase session.
- `PROVIDER_SIGNING_SECRET`: random 32+ character server secret.

## Cost enforcement

Environment enable flags AND database settings must both enable a provider. PostgreSQL row locks serialize budget reservations across Vercel instances; reserve before request. Failed/unknown requests keep their conservative reservation. Max 60 external calls/user/hour; Google max 20 calls/session. Timeout 7 seconds; no automatic retry amplification. Daily/monthly caps use database UTC.

Reservation units are millionths of USD. Defaults: autocomplete .004, details .010, Kakao keyword .001. These are operational upper estimates, not provider billing prices. Configure real platform quotas and reconcile actual invoices before launch. Map SDK billing is separate from Places and not prevented by Places request caps.

Usage logs omit query strings, raw provider responses, candidate tokens and keys. User identifiers are used privately for rate limits. Product events use structured application logs; no third-party analytics SDK or fingerprinting.
