# Unified desktop home — 2026-10-30

final result: passed

## Visual comparison

- Selected reference: `prototypes/archive/home-explore-2026-10-30/unified-selected-reference.png` (1487×1058). Actual: `artifacts/unified-home/desktop-1440.png` (1425×1013, CSS viewport 1440×1024). Opened both and reviewed at normalized width; aspect ratios differ by less than 0.1%. Reviewed `mobile-preserved.png` separately at CSS 390×844. Supporting filtered screenshot: `fashion-seoul.png`.
- Unified centered title/search, four muted matte-gradient category pills, sort/region toolbar and three-column photo cards match the selected composition. Removed the redundant separate editorial Home/Explore hierarchy. Tightened intro spacing and reduced minimum card height from 210 to 200px after comparison to preserve the reference's information density. Titles remain SUIT 500 rather than the generated mock's heavier weight, honoring the user's typography preference. No remaining actionable P0/P1/P2 visual findings in the scoped comparison.
- Real supplied photographs, real place counts and existing account/studio/admin navigation intentionally replace illustrative reference content. In particular ramen has 2 actual places, not the mock's 27. Existing photo focal points, including the complete burger subject, remain in use. Selected Hype uses a filled lime flame/count and olive border/dark surface; non-selected buttons remain neutral regardless of total count.

## Functional checks and boundaries

- Live local app: category Fashion → region Seoul gives 2 results with nationwide inclusion labels; entering a map uses the existing detail; browser back restores exact conditions. Existing viewer Hypes and saves are displayed correctly. No live reactions or database records were changed. Current mobile home, categories and enabled viewer state were checked after resizing. Browser error log was empty; viewport override reset and result tab retained.
- Fixture E2E verifies 24→33 results, limit/scroll restoration, combined search/category/region, 3 columns and no horizontal overflow at 1024/1280/1440/1920, selected Hype color/fill, failed cancellation rollback, retry and exact anonymous login return. Full suite includes mobile map/place/registration/saved flows. Legacy desktop heading expectations were updated to the approved new text; no detail implementation changed to satisfy tests.
- Validation: typecheck passed; unit tests 57 files / 191 passed; final full production-build E2E 208 passed / 70 platform or environment skips / 0 failed. ESLint has 0 errors and 2 warnings for the original prototype's unused-expression idiom and its archived copy. `git diff --check` passed. Image source/reference and final actual screenshots were visually inspected.
- Production data/API/schema unchanged. Existing uncommitted `globals.css` and `community-explorer.tsx` edits were preserved and not edited in this task. Separate Home/Explore HTML/CSS/JS and assets are archived in `prototypes/archive/home-explore-2026-10-30/`, with a runnable nested-path preview and README. Original `prototypes/desktop-v2/` remains available. No commit, push or deployment.

---

# Desktop home restoration — 2026-10-29

final result: passed

- User requested the previous desktop home while retaining the current mobile catalog. Home now displays existing DesktopDiscovery at widths >=1024px, and the current MapCatalog below that breakpoint. /discover remains unchanged.
- Reused the existing desktop module and original page width/padding/footer. Desktop location search uses current deduplicated region summaries; raw addresses are not reintroduced. Personal engagement reads are limited to the active viewport surface.
- Live desktop verification: original headline, search, theme filters, popular/saved sorting, image/title overlays and expandable preview are present. Searched vintage to one result, expanded its existing-map link, and switched saved/popular sorting. No reactions changed.
- Live mobile verification at 390×844: top search, four categories, one featured plus six regular cards, saved/Hype state and current typography remain unchanged; desktop surface is hidden and no horizontal overflow. Temporary viewport reset.
- Screenshots: artifacts/catalog-redesign/desktop-restored.png and mobile-after-desktop-restore.png. Both opened for visual inspection. Typecheck, scoped ESLint and git diff --check passed. The earlier full-suite results below predate this restoration and were not rerun for this scoped wiring change.
- Remains uncommitted; no push or deployment.

---

# Home and discover catalog redesign — 2026-10-29

final result: passed

## Visual truth and comparison

- Selected reference: `artifacts/catalog-redesign/selected-reference.png` (853 × 1844). Final implementation: `mobile-home.png` (375 × 812 at CSS 390 × 844), `desktop-home.png` (1425 × 1013 at CSS 1440 × 1024), and focused `feature-detail.png`, all in the same artifact directory. Reference and actual mobile/full and focused views were opened together. Compared normalized proportions, allowing for browser capture scaling and scrollbar width; reference/actual aspect ratios differ by less than 0.2%.
- User's explicit specifications take precedence over generated reference pixels: featured card minimum height 210px mobile / 240px desktop, SUIT 500 titles, smaller place counts, one featured plus up to six standard maps. Existing logo, supplied photographs, charcoal/lemon identity and independent save/Hype controls retained. Featured Hype sits beside the place count; bookmark remains top-right. Real saved states and counts replace illustrative reference values.
- Additional evidence: `desktop-discover.png`, `mobile-region-results.png`, `mobile-filters.png`, `mobile-320.png`. Checked 320,390,430,768,1024,1440px and 200% root text size. Narrow cards become horizontal rows; content grows without horizontal overflow. No remaining actionable P0/P1/P2 visual differences.
- Fixed during comparison: mobile fixed header obscuring search (scoped top spacing), redundant desktop header spacing, mobile filter sheet retaining centered-dialog translation, uneven card footer alignment, and conflicting valid category/theme selections losing their visible selected option. Final screenshots follow the fixes. Viewport override reset after browser verification.

## Functional and accessibility verification

- Shared editorial configuration and summary model drive home/discover. Unknown public maps remain discoverable without invented categories; private/empty featured candidates are excluded. Search aliases, cross-field tokens, combined conditions, regional inclusion, ranking and canonical URL handling have unit coverage. Raw place addresses are summarized server-side rather than serialized to the client.
- Browser coverage includes direct map navigation, browser-back URL/scroll/result-limit restoration, 24-at-a-time results, independently removable conditions, filter sheet focus restoration, empty results, image fallback, personal-state retry, optimistic reaction rollback and exact anonymous login return. No reaction is replayed automatically after login.
- Live account checks verified Hype and save persistence after reload and map/back preservation of category and region. Temporary reactions were cancelled; original Vintage/Tokyo saves and Taco/Burger Hypes remain unchanged. Final browser error log was empty.
- Controls are siblings of navigation links, with map-specific labels, pressed/busy states, keyboard focus and minimum 44px hit areas. Measured text contrast on the information surface: primary 14.02:1 and muted 8.78:1. Photo contrast was visually reviewed; this is scoped verification, not full screen-reader/WCAG certification.
- React review: shared state hook, public/private data separation, cancelled stale reads/restoration frames, no nested interactive controls, no new heavy dependency, scoped catalog styling.

## Test evidence and performance

- Full unit suite: 190 passed. Full production-build browser suite: 205 passed, 67 platform-specific skips. Subsequent targeted verification after polish: 10 passed; layout checks 19 passed / 15 platform-specific skips; final featured-control checks 4 passed. Typecheck, full ESLint, production build and diff whitespace checks passed. Map pins, registration and saved-list regression coverage retained.
- Same local dev environment, unauthenticated document requests, one warmup discarded and three samples: home HTML 140,779 → 78,108 bytes (44.5% smaller); discover 82,420 → 82,499 bytes. Median document response times 63 → 61ms and 51 → 45ms respectively. These noisy dev timings do not establish a production loading-time improvement; HTML reduction is not a claim about images, JS or LCP.
- Cold regional summary generation still scans existing public place addresses server-side. This is documented for future scaling; client receives deduplicated summaries only. Home rendering remains capped at seven maps as inventory grows.

## Scope and handoff

- Configuration and operational notes: `docs/design/home-catalog.md`; editorial source: `src/domain/catalog-config.ts`. Existing preview components remain for compatibility fixtures and preserved prior work, but production home/discover no longer use accordion previews.
- Prior uncommitted changes preserved. Work remains uncommitted on main. No database migration, commit, push or deployment performed.

---

# Mobile map Hype and save — 2026-10-28

final result: passed

## Visual truth and comparison

- Selected target: `artifacts/mobile-engagement/selected-reference.png` (853 × 1844): option 1 revised with smaller controls. Implementation: `artifacts/mobile-engagement/implemented-390.png` (375 × 812 browser capture at CSS 390 × 844). Compared the full reference and actual capture together, normalizing by width (~0.44); matching aspect ratios, same collapsed/top-of-home state. Focused actual card: `artifacts/mobile-engagement/first-card.png`.
- Top-left Hype pill 52 × 28px, top-right bookmark circle 28px, icons 14px. Tap targets measured as 52 × 44 and 44 × 44 CSS pixels. Selected state uses lime icon on dark glass rather than solid lime circle. Title/location lower-left, count lower-right, original capsule/photo/glass treatment and fixed search retained. Card min-height 144px accommodates distinct controls without overlapping title.
- Actual user-provided cover photographs and real reaction/save counts intentionally replace illustrative mock photos/counts. Actual map order is retained. The selected design's button placement, size, hierarchy and four-row density are present; no actionable P0/P1/P2 differences. Existing SUIT and Lucide system reused; no new raster assets or dependencies needed.
- Narrow viewport evidence `implemented-360.png`; document content does not exceed viewport width. Existing automated mobile preview regressions cover 320,390,768px. Viewport override reset after verification.

## Interaction verification

- Mobile now loads private reaction state through the existing shared hook/API; only the currently active mobile/desktop surface initiates its read. Existing authenticated RPCs and save/follow persistence are reused without schema changes.
- Controls are siblings of the preview button; independent busy/disabled state, accessible map-specific labels, aria-pressed, focus indication, retry, optimistic update and rollback retained. Demo controls disabled. Close-preview moved into its own non-overlapping position. Preview counts now say 저장 rather than 팔로워.
- Live signed-in mobile check: Vintage Hype persisted after reload, then cancelled; Korea Fashion Store save persisted after reload, then cancelled. Final state restores original two saves (Vintage, Tokyo) and preserves user's preexisting Taco/Burger Hypes. No other user reactions changed.
- Targeted production-build browser suite: 12 passed, 12 platform-specific skips. Covers new mobile save loading, independent buttons,44px hit areas, Hype/cancel failure rollback, save cancellation, anonymous login, retry, preview open/close, desktop behavior and mobile search/preview scrolling. Unit suite186 passed; typecheck and full ESLint passed.
- Console review: one development Fast Refresh warning was recorded while changing a hook dependency array during editing. Full reload cleared the transient condition; no new runtime errors after reload. Production browser tests passed.
- React review: hooks remain unconditional; stale fetches cancelled; state changes stay in interaction handlers; personal data stays out of public cache; no nested interactive controls.

## Comparison history / follow-up

- Final polish aligned place count to the lower edge, matching the approved title/count hierarchy. Final screenshot recaptured after that adjustment.
- No remaining P0/P1/P2 findings. P3: actual covers and the established mobile rim differ from generated illustrative photography. Full screen-reader certification is outside this scoped verification.
- Local main changes remain uncommitted; no deployment performed.

---

# Homepage map Hype and save — 2026-10-27

final result: passed

## Selected design and visual verification

- User selected option 1: Hype glass pill at the top-left of each cover, bookmark circle at the top-right, and popular/saved/newest sorting above the grid.
- Visual reference: `artifacts/map-engagement/selected-reference.png`. Final actual browser capture: `artifacts/map-engagement/implementation-desktop.png`, CSS viewport 1440 × 1024. Both images were opened together for direct visual review, accounting for the reference's different canvas scale.
- Actual implementation retains the existing real cover photos, fallback gradients, lower title/count overlays and glass borders. Mock recommendation numbers and illustrative extra photographs were intentionally replaced by real data. Hype starts at zero; existing saved maps remain highlighted.
- The selected design's placement, spacing hierarchy and compact corner controls are present. Existing typography and slightly shorter production cards are preserved. No unresolved P0/P1/P2 visual findings.
- Narrow desktop capture: `artifacts/map-engagement/implementation-1024.png`; browser DOM verified width and document scrollWidth both 1024, with all nine Hype controls present. Temporary viewport override reset.

## Functional and security verification

- Hype is authenticated, idempotent and reversible; popularity uses enabled Hypes created within seven days. Retoggling an old reaction does not renew its original date. Zero-score ties favor populated maps.
- Saves reuse existing map follows and appear in the existing saved page. Card controls are siblings of the preview, with independent pending states, accessible labels, visible keyboard focus, optimistic feedback and rollback on failure. Private state fetch has retry and never fabricates unchecked state after an error.
- Live signed-in check: created Hype, verified it survived reload, then cancelled it; saved Korea Fashion Store, found it in the saved-map collection, then cancelled it. Final home confirms all Hypes unchecked and only the original Tokyo Fashion Store and Korea Vintage Shop saves selected. No browser console errors returned.
- New production migration `20261027075253_map_hype_and_saved_maps.sql` applied to the actual app project; nine public map aggregates returned and anonymous direct reaction-table reads were denied. RLS restricts individual records to their owner; writes use authenticated validated RPCs. Existing map data preserved.
- Typecheck, ESLint and production test build passed. Unit tests: 186 passed. Full browser suite: 195 passed, 67 skipped. Isolated Postgres/PostGIS tests passed, including duplicate toggles, time window, ownership, anonymous restrictions and direct-write denial. Local security advisors at error level returned no issues. Latest cold-start tie-break regression passed in the final unit run.
- React best-practices review: parallel independent reads, private viewer state outside public cache, functional state updates, cancellation of stale reads, no nested interactive elements, no added heavy dependencies.
- Code remains uncommitted on main; production frontend has not been pushed/deployed. Database schema is already applied.

---

# Earlier design QA (retained history)

# Desktop home redesign — design QA

final result: passed

## Visual truth and scope

- Selected visual: `artifacts/desktop-home/selected-reference.png` (1487 × 1058), the latest approved image with names and counts inside the covers. The user's later instruction to strengthen the bottom gradient takes precedence over the image.
- Implementation: `http://localhost:3000/`, current local main, logged-in account, nine actual public maps, no search/filter, previews closed, scroll at top.
- Final screenshot: `artifacts/desktop-home/desktop-final-1440.png` (1425 × 1013). CSS viewport 1440 × 1024; devicePixelRatio 1. CUA's full viewport capture is scaled by approximately 0.989 relative to CSS pixels. Source art represents the same logical 1440 × 1024 target at approximately 1.033 scale.
- Full-view comparison: source and implementation were opened together in one image review input. Compared normalized page proportions rather than raw pixels; source-to-capture scale is 1425/1487 horizontally and 1013/1058 vertically (under 0.1% aspect discrepancy). No generated pixels were modified to manufacture a match.
- Focused evidence: `artifacts/desktop-home/card-detail.png` (850 × 230 browser clip) shows the first two cards, readable overlay titles/counts and the actual covers. Also checked DOM geometry for title/count containment and image filter.
- Additional states: `preview-open.png`, `desktop-1024.png` (1009 × 757, CSS 1024 × 768), `mobile-390.png` (375 × 812, CSS 390 × 844). Native capture scale differs by browser viewport; responsive findings use CSS sizes and DOM measurements.
- Existing codebase was edited in place. Existing SUIT fonts, Lucide icons, logo and all four real cover photographs were reused. No generated replacement photographs, new backend operations or schema changes were introduced.

## Findings and comparison history

- Latest glass-card refinement: approved component reference `artifacts/desktop-home/glass-reference.png` (two enlarged states). The user explicitly requested a stronger glassmorphism treatment. Added a fading upper-edge rim, inset neutral reflection, translucent card surface/backdrop blur, slightly rounder corners and restrained hover brightening. Existing image assets, text positions and the strong lower title gradient remain intact. Component shape follows the existing homepage cards rather than the taller explanatory mock.
- Glass evidence: `artifacts/desktop-home/glass-cards.png` (page context) and `artifacts/desktop-home/glass-card-detail.png` (focused hover state). Source and focused implementation were opened together; compared the border treatment after accounting for the enlarged reference scale. Live inspection confirmed hover reflection/rim opacity 1, `mask-composite: exclude`, and card backdrop blur. Preview opened/closed normally. CSS transitions are disabled for reduced motion; the lime keyboard focus outline remains. No new actionable P0/P1/P2 findings.
- After the glass-only CSS adjustment, the production test build and six targeted desktop home/footer/search/filter/preview checks passed. Earlier complete-suite results below remain historical; no claim that the entire suite was rerun for this styling adjustment. Mobile uses separate unchanged styles.

- Latest minor refinement: removed the headline period and strengthened the title-area gradient again. Verified in the live browser at scrollY 0; `artifacts/desktop-home/headline-gradient-refinement.png` captures the header, headline and first card row (native window capture is vertically clipped despite the 1440 × 1024 CSS viewport). Earlier full-page-state evidence is retained separately. Targeted ESLint and diff checks passed; the earlier complete suite was not rerun for this copy/CSS-only adjustment.

1. [P2, fixed] Initial full-view comparison showed the map grid starting too low and most third-row labels falling below the selected viewport. Evidence: `desktop-1440.png`. Reduced intro padding from 34/24px to 28/12px, search top margin from 20px to 14px, theme margin from 14px to 10px and grid row gap from 20px to 16px. Post-fix evidence: `desktop-final-1440.png`, which exposes the third-row names and counts while keeping natural page scroll.
2. [Intentional requirement] Bottom cover gradient is stronger than the selected image: transparent upper section, 88% dark at 62% of tile height, 96% at 82%, and fully dark at the bottom (strengthened again at the user’s request). The image itself has no uniform brightness or blur filter in the desktop home. Hover does not remove the reading contrast.
3. [Preserved behavior] Cards retain their existing expandable description and map link. The selected visual shows only the collapsed state. Search results can be combined with theme filters, submitted with Enter or the arrow button, and recovered from an empty state. Clearing/resetting returns focus to the search input.
4. [Accepted product constraint] Generated abstract gradients were illustrative. Existing deterministic color covers remain for maps without photos; real location/theme labels, logged-in navigation and counts come from current data. Mobile keeps its original cover treatment via the default MapCardBackdrop behavior.

## Required fidelity surfaces

- Fonts/typography: existing SUIT family; compact 34–42px intro heading, 19–23px card titles, 13px secondary metadata and 24px secondary counts. Titles allow two lines; title and count reserve separate flex regions. Full-view and focused captures show readable text without collisions.
- Spacing/layout: centered compact intro, one 680px search field, small theme controls, three equal map columns from 1280px, two columns at 1024–1279px, 64px desktop gutters. No independently scrolling list. Existing footer follows the content and remains reachable at short desktop heights.
- Colors/tokens: existing dark surface, lime primary and warm-white text. Stronger local lower gradient is user-directed. Header loses its enclosing pill only on the desktop homepage; other pages and mobile retain existing header styling.
- Image quality/asset fidelity: actual palace, Shinjuku, tacos and Choiza poster covers; desktop sharp mode removes blur/blanket dimming and preserves object-fit cover. Existing fallback gradients are reused rather than replaced with invented stock images. No new image assets were required.
- Copy/content: headline ends in 지도 with no period, as requested; subline, search prompt, map section and theme labels match the approved direction. Locations and theme names retain real data instead of hard-coded illustrative mock labels.

## Interaction and regression verification

- Manual browser verification against nine real maps: 맛집 filter returns four, combining 타코 returns one, unknown search returns zero, reset restores nine; Tokyo preview reveals its existing description and map URL. No production data was modified.
- Browser error logs checked after primary interactions: no errors returned.
- 1024px manual check: two columns, no horizontal overflow. 390px screenshot confirms the existing mobile home. Automated responsive checks cover 360, 390, 430, 768, 1024, 1440 and 1920px.
- Typecheck and ESLint passed without warnings; unit tests 180 passed; isolated production build and full browser suite 193 passed, 65 environment-specific skips.
- First browser run found one outdated test expecting the previous homepage headline. Updated that assertion and the obsolete side-by-side panel geometry assertion to reflect the selected stacked design; the final complete suite passed.

## Accepted differences / follow-up polish

- P3: the existing ambient background and actual fallback palettes differ from generated illustrative pixels. They intentionally preserve the current site's assets and identity.
- P3: generated mock navigation includes a fixed account and an active underline; implementation retains real account permissions/navigation instead of hard-coded user UI.
- Full WCAG conformance is not claimed. Keyboard search/filters, focus restoration, visible focus, semantic labels and title/count containment were checked; this is not a screen-reader certification.

## Implementation checklist

- [x] Selected compact search-first structure implemented on desktop.
- [x] Actual cover images with names/location/count inside, stronger lower gradient.
- [x] Search, themes, no-results reset and existing preview/map links work.
- [x] Shared cover default and mobile styling preserved.
- [x] Final full-view and focused visual review completed after spacing fix.
- [x] Responsive checks, production test build and full regression suite passed.

---

# Previous map discovery QA (retained history)

# Desktop discovery redesign — design QA

final result: passed

## Visual truth and scope

- Selected direction: second displayed ideation image, with the user's later request for a tightly padded shared like/dislike capsule and one central divider.
- Source: `artifacts/design-review/search-sidebar/selected-compact-capsule.png` (1586 × 992).
- Implementation: `http://localhost:3000/maps/tokyo-fashion`.
- Desktop evidence: `artifacts/design-review/search-sidebar/implementation-desktop.png` (1425 × 891).
- Browser CSS viewport: 1440 × 900. Native browser capture is approximately 0.99 pixels per CSS pixel. The mock was normalized to the captured 1425 × 891 size; aspect ratios differ by less than 0.04%.
- Normalized truth: `artifacts/design-review/search-sidebar/reference-normalized.png`.
- Full comparison (source left, implementation right): `artifacts/design-review/search-sidebar/comparison-full.png`.
- Focused search/list/reaction comparison: `artifacts/design-review/search-sidebar/comparison-controls.png`.
- State: desktop, default recommendation order, no search or filters, same seven public places, logged-in owner context, first-place vote and save selected. Mobile search was also inspected at 390 × 844: `artifacts/design-review/search-sidebar/implementation-mobile-search.png`.

## Findings and comparison history

1. Initial implementation had a double grid gutter because the inactive detail column still consumed two gaps. Reduced the empty-column gutter so the effective sidebar-to-map gap is 16px. The layout regression verifies a positive gap no greater than 20px and aligned list/map tops.
2. Initial focused comparison showed description text too small relative to the chosen visual. Increased desktop list description text to 13px / 20px and row vertical padding to 14px. Post-fix full and focused comparisons above show the corrected hierarchy. Earlier evidence is preserved in `comparison-full-before-type.png` and `comparison-controls-before-type.png`.
3. No remaining actionable P0/P1/P2 differences. The capsule is deliberately smaller than the generated mock: 82px × 28px for single-digit counts, following the user's final correction. Each side has its own button, accessible name, selected state and keyboard focus; longer counts can grow naturally.

## Required fidelity surfaces

- **Fonts / typography:** retained the application's Korean SUIT/system typography and existing heading weights. Search is 14px, segmented controls 12px, descriptions 13px / 20px, compact reaction counts 11px. Existing global header and hero typography are outside this change. Long place names wrap and descriptions retain two-line truncation.
- **Spacing / layout:** full-width toolbar removed on desktop; one search field and visible three-way sort group are inside the sticky discovery header. Result count and filter disclosure sit below. Responsive sidebar is 304–348px wide, effective map gutter 16px, and map/list top edges align. The detail panel remains its own grid column. Sidebar controls remain visible when the list scrolls.
- **Colors / tokens:** retained charcoal and the existing lime primary token. Flat sidebar surfaces, thin separators, subdued input border and tinted active control. No new decorative gradients or shadows. Existing global page background retained.
- **Images / assets:** retained the application's map renderer, live place pins, original brand mark and existing Lucide icons; no rasterized interface or substitute map image. Map zoom/position can differ from a generated illustration because it is interactive.
- **Copy / content:** kept the same real seven-place map and existing actions. Search says “이 지도에서 장소 검색”. Existing precise sort copy “최근 추가순” retained. Result count remains visible. Filter disclosure reuses existing region/tag capabilities; it does not introduce new backend behavior.

## Functional and accessibility evidence

- Browser checked: search “Graphpaper” reduces both list and map to one matching place; clearing restores the full map. Filter opens, closes with Escape and restores summary focus. Mobile search opens and closes in its original floating layout.
- Regression checked: sticky search stays visible after list scroll; empty search has zero pins and recovery restores six demo pins; segmented sort is discoverable in the header; reaction group contains two compact independently named buttons.
- Existing full E2E run: 188 passed and 61 conditional skips, with one newly authored selector error. The selector was fixed to target the labelled desktop filter summary; that new desktop regression passed separately. After the final typography adjustment, all eight applicable discovery/responsive tests passed (eight conditional skips).
- Unit tests: 175 passed. Typecheck, lint and production build passed. Final lint has no warnings or errors. Production audit reports zero vulnerabilities.
- Browser console error log checked through the browser API: no errors returned.
- No new database writes were used for manual visual validation. Existing optimistic vote/save and mobile gesture tests passed in the isolated test environment.

## Accepted differences / follow-up polish

- P3: existing hero spacing is retained; the live map starts approximately 12px below the normalized generated mock's map. This does not hide controls or alter the requested hierarchy.
- P3: generated typography and map geography are illustrative. The existing SUIT font, real map data, exact labels and latest request for an 82px capsule take precedence over pixel-level generated details.
- Desktop-only compact reaction controls have 26px-high button interiors; mobile continues using its existing larger touch controls.

## Implementation checklist

- [x] Search and sorting moved into desktop discovery header.
- [x] Result count, keyboard-accessible filter and existing map tags retained.
- [x] Shared compact capsule, short central divider and independent selected states.
- [x] Search/list/map synchronization and empty-state recovery verified.
- [x] Mobile search layout and existing interactions verified.
- [x] Same-state full and focused visual comparison completed after fixes.
- [x] Existing unrelated local changes to AGENTS.md and next.config.ts preserved.
