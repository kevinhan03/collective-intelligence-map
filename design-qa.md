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
