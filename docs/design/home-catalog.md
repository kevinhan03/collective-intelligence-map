> 2026-10-30: Desktop home (>=1024px) now uses the approved unified catalog in `UnifiedDesktopHome`. Search, four subdued-gradient categories, region and popular/saved/creation sorting operate on one three-column image-card list. No separate recommendation/category-card sections or desktop Explore navigation. `/discover` is retained as a compatible route showing the same desktop catalog. The current mobile MapCatalog and map/place details are retained. The archived separate Home/Explore HTML concept is in `prototypes/archive/home-explore-2026-10-30/`; its README explains how to run it. The older plan below is historical where it differs from this note.

## Unified desktop behavior

`parseUnifiedCatalogFilters` and `unifiedCatalogHref` use `q`, `category`, `region`, `sort`. Popular (weekly Hype) is the default; saved/newest are explicit options. Legacy hidden theme parameters are ignored. Search, category and region combine; each active condition can be removed individually. Twenty-four results are initially exposed, with more in batches of 24 and per-URL tab-session restoration of limit and scroll.

The desktop component reuses the server catalog summaries, editorial photo framing and `useMapEngagement` contracts. Viewer-selected Hype has a filled lime flame, lime count, olive border and dark tint; save/Hype remain separate from card links with optimistic failure rollback and exact login-return URLs. Map links open the existing detail directly. No database migration, raw-address payload, production data edit or new API is involved.

Desktop styles are scoped to `unified-desktop-home.module.css`; current mobile styles, global map-pin styles and detail components are not part of this change. SUIT 500 headings and 400 metadata intentionally override the generated reference's heavier lettering. Real images, counts and account navigation are retained rather than generated illustrative content.

# Home and catalog operations

## Editorial configuration

`src/domain/catalog-config.ts` is the single source for the curated public maps' discovery titles, primary categories, aliases, image paths/focal points, default order, feature flag and feature reason. This is a code-managed first version: changing these values requires a normal frontend deployment. It does not rename stored maps or change their URLs. `region` can correct a known theme's primary display region without changing its database record.

Only public non-creator maps returned by the existing query enter the catalog. Unconfigured public maps retain their original title and stable image fallback, appear in the full list, have no inferred category, and cannot become the feature. A configured feature also requires a positive public place count. Home selects at most one feature and six other maps without duplication.

`MapCardBackdrop` uses the same image metadata everywhere it is reused; failed images fall back to the existing deterministic palette. Whole-subject burger framing is retained. Add future map entries here instead of adding slug checks in card components.

## Discovery contract

Mobile discovery now exposes search and category only. The filter sheet is removed; region, detailed-theme and sort parameters from older URLs are ignored on mobile. Default ordering retains search relevance when a query is present. Desktop discovery retains its inline controls, and the restored desktop home is unchanged.

`q`, `category`, `region`, `theme`, and `sort` encode the active result state. Invalid condition values are ignored. Search matches every normalized query token across discovery/original names, editorial aliases, description, tags and regional summaries. Default results use editorial order, with query relevance and selected-region specificity taking precedence. Explicit popularity uses enabled Hypes from the last seven days, while cards show cumulative Hypes. Newest means creation date, not publication date.

Coverage is derived from public approved/disputed places and deduplicated on the server. Country/city values are available in the filter; recognized district summaries also assist text search. Unknown addresses are not guessed into regions. Original address strings are never passed as home search data. A nationwide map matching a selected city is labeled with city inclusion and an explicit total-place count.

The initial catalog renders 24 results and adds 24 per activation. Per-tab session storage retains display limits and scroll keyed by canonical filters. Storage failure does not block browsing. Login returns to the current local URL without automatically replaying a reaction. Existing public-cache invalidation, authenticated reaction APIs, optimistic updates and rollback are reused; no database schema or API response contract changes.

## Styling and boundaries

Home and discovery share scoped catalog components. SUIT variable 500 is used for headings/map names; 400 for descriptive text. General cards have readable opaque information surfaces, light rims and glass reaction controls. Recommendation photography retains its dark lower overlay. Touch targets remain at least 44px while controls appear 28px tall. Root-relative type supports text enlargement; narrow containers use rows rather than squeeze two cards below 160px.

The existing mobile/desktop accordion components remain as compatibility fixtures and to preserve pre-existing local work. The production home and discovery routes no longer import them. Map internals, submission, creator and saved-page flows are otherwise unchanged. No commit, push, deployment or migration was performed.

## Verification and performance evidence

See project-root `design-qa.md` for visual comparison, screenshots, test results and limitations. Browser regression coverage includes canonical-filter navigation, direct map entry, history return, more-results restoration, filter-sheet focus, conflicting conditions, image failure and authenticated reaction error handling.

HTTP benchmark: four sequential requests per route to the same running local development server, first warm-up discarded, no authentication cookies or compression requested. Three measured samples before and after:

| Route       | Before bytes | After bytes | Before median | After median |
| ----------- | -----------: | ----------: | ------------: | -----------: |
| `/`         |      140,779 |      78,108 |         63 ms |        61 ms |
| `/discover` |       82,420 |      82,499 |         51 ms |        45 ms |

Home HTML transfer size decreased by approximately44.5%; discovery is essentially unchanged in size despite added features. These small local timing differences are not evidence of a production loading-time improvement. This measured HTML/RSC document size, not all images, JavaScript, LCP or a controlled production benchmark. Current public-map/places inventory and development caching constrain comparisons.

This version still scans public place addresses on the server when its regional cache is cold. Large place inventories may require database-side region aggregation and server-paged search later; the current change reduces browser payload and rendered home volume, not that cold-cache scan complexity.
