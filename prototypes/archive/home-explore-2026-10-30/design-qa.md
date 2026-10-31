# Desktop home / explore HTML prototype — 2026-10-29

final result: passed

## Latest iteration: existing map fallback palette

- Replaced pastel category gradients with the exact fallback palette triples and layered radial/linear composition from `src/components/community/map-card-backdrop.tsx`: warm brown/plum, olive/taupe, blue/slate-purple and rose/plum. Retained opaque matte tiles without backdrop blur, photo, rim or shadow. Text/arrow changed to light colors for contrast.
- Browser evidence: `captures/category-map-palette.png`; all four tiles inspected, no background photos and backdrop-filter:none verified. Other map cards and product routes unchanged. Diff whitespace check passed.

## Latest iteration: matte category tiles

- Applied the user's supplied matte product-card reference only to category overview tiles. Removed cover images, overlay shades, rim/border and backdrop blur. Used opaque, low-saturation beige/sage/blue-gray/lavender gradients,32px corners, generous26px padding, dark21px titles and13px counts. Map-photo cards remain unchanged.
- Evidence: `captures/home-matte-categories.png` and `captures/matte-category-detail.png`. Live inspection confirmed four320×144px tiles, no background images and computed backdrop-filter:none; all eight map photographs remain intact. Fashion tile still navigates to three matching maps. Browser screenshot reviewed against the supplied reference's soft corners, matte surface and text hierarchy. No actionable P0/P1/P2 issue found; JavaScript syntax and diff checks passed.

## Latest iteration: centered home introduction

- Replaced the photo hero with the original centered headline, one-line description and680px search field. Removed English eyebrow, repeated cover photo, secondary copy and competing text links. Retained the user's lighter500 heading weight and the newer section structure; category chips remain removed.
- On home the header search is hidden so only one search is visible. Explore/saved retain their header search. Both forms use a shared delegated submit handler; verification found and fixed use of the document as FormData target before handoff.
- Live home search “서울 타코” returns one matching explore card; explore remains three columns at1470px. Back to home: one visible search, no photo banner, no horizontal overflow. Final screenshot `captures/home-centered.png` inspected against the supplied original-home composition; existing card style/sections are preserved. Syntax/diff checks passed. Existing Next.js application remains untouched.

## Latest iteration: unified cards

- User requested the recommendation-card design for “더 많은 테마” and explore, and exactly three desktop explore columns. All map cards now share the `overlay-card` component styling: full-cover image, lower gradient, overlaid title/location, category capsule, place count, Hype top-left and save top-right. Category overview tiles retain their separate purpose and style.
- Desktop browser at1470px: nine explore cards in three359px columns, no horizontal overflow. Home: all eight recommendation/general cards use the same232px height. Narrow layouts retain two columns below768px. Existing product code remains untouched.
- Evidence: `captures/explore-unified-3col.png`, `captures/home-unified-cards.png`. Browser screenshots reviewed; no overlapping controls or clipped names found. JavaScript syntax and diff checks passed. This replaces the earlier four-column explore configuration documented below.

## Visual target and scope

User requested preservation of the existing desktop visual language, with a new independent HTML information architecture. Visual truth: `captures/source-home.png` (1470×719 pixels; current-product browser capture) and `../../artifacts/catalog-redesign/desktop-restored.png` (historical desktop reference). The supplied two-screen reference defines the intended home sections and sidebar/result relationship, not replacement photography or invented map inventory.

Implementation: `http://localhost:3335/`, home; `#explore`, unfiltered nine-map catalog. Evidence: `captures/home-viewport.png` (1470×775), `captures/home.png` (1470×1550), and `captures/explore.png` (1470×1221). Implementation CSS viewport 1470×775; screenshots use 1 pixel per CSS pixel. Source capture has the same width but a shorter visible browser region: compare shared horizontal scale and components, never stretch full images to equal heights. Full-page captures include below-fold content.

## Comparison history

- Initial live review: charcoal/lime tokens, supplied covers, 20px glass-rim cards, independent 44px save/Hype controls and SUIT typography retained. Home is intentionally recomposed into a compact hero and bounded sections. Explore uses an independent sticky sidebar and denser four-column grid at >=1360px.
- P2 fixed: explore sorting pills stretched to the result-header height because generic nav alignment affected them. Added explicit centered self-alignment; narrowed all header-nav rules to `.header nav` after responsive review found its mobile 60px height leaking into sort navigation. Final sort heights measured 34px desktop / 44px narrow. Final `captures/explore.png` and `captures/explore-390.png` show the correction.
- Full-view comparison: source-home, final home-viewport, final explore and narrow explore were opened together in one image-review input. This is an intentional information-architecture revision, not a pixel clone: retained visual vocabulary, changed hero alignment/header search placement, bounded featured row and explicit category overview.
- Focused comparison: `captures/card-detail.png` (656×240) was opened with the source and actual home. It confirms supplied image sharpness, overlaid titles, bottom shade, rim/radius and separate corner buttons. No remaining actionable P0/P1/P2 differences.

## Five fidelity surfaces

- Typography: installed SUIT variable font loaded successfully; titles use 500 rather than the old heavy weight, honoring the user's established preference. Main message 40px desktop, section headings 22px, feature names 19px, standard names 17px, muted metadata 12px. No clipped names found.
- Layout rhythm: existing max-width1440, roughly56px desktop side gutters, 20px card radii, restrained glass rim. Home has a294px hero and one four-card featured row; explore has a185px sidebar / four grid columns at1470px, two at1024px. No horizontal overflow at1470,1024 or390px. Mobile support belongs to this isolated prototype; the real mobile product remains untouched.
- Colors: charcoal#171d25, panel#202730, lime#edff70 with dark selected text. Primary text#f4f6ef and muted#acb5c0 follow the established palette. Image-title gradient remains intentional to preserve readability.
- Assets: existing nine cover photographs and library-generated Lucide SVG assets reused. No fake photography, avatars, decorative imagery or handcrafted illustration. Browser reported no failed images; burger framing remains visually complete in explore.
- Copy/content: original brand headline retained. Four current categories and nine sample maps only. No invented trending badges or publication dates; “더 많은 테마” replaces unsupported new-publication claims. Region/count snapshots are explicitly illustrative in README, and saves/Hype are described as preview-only.

## Functional evidence

Home category → fashion (3 maps) → Seoul (2 nationwide maps with inclusive total labels), place-count sorting, prototype save → saved collection → reload persistence → cancellation, Hype → cancellation, empty search → all results, and browser back to home verified. Final browser console error list empty. Prototype test saves/Hypes returned to empty state; production data was never changed. Browser viewport override reset and home tab marked deliverable.

Semantic navigation/links, independent save/Hype buttons with44px targets and pressed labels, lime keyboard focus outlines, labeled search, reduced-motion styling and44px narrow region/sort controls are present. This is scoped browser verification rather than full assistive-technology certification. `node --check` passes for app.js and preview.mjs; git diff whitespace check passes. No repository-wide production build/test rerun needed because no existing application source was changed.

## Follow-up polish

- P3: adjust hero height, section copy, feature choices and sidebar density with the user using this live prototype.
- Publication-date-backed new-map sections and live regional counts belong to a later approved implementation. Current prototype uses local snapshots only.
- Existing service routes, mobile UI, theme-map details and place details are unchanged. No commit, push or deployment performed.
