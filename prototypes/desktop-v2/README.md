# Ting Map desktop home / explore prototype

## Required for production implementation

- Preserve the existing viewer-specific Hype selected state (user reference, 2026-10-29): when the signed-in viewer has hyped a map, use a filled lime flame, lime count and lime/olive capsule border with a dark tinted surface. An unselected map must retain the neutral outline treatment even if its total Hype count is nonzero. Cancelling returns to neutral. Apply consistently to home recommendation/general cards, explore and saved maps; restore the actual viewer state after refresh/login and roll back the visual state if the request fails. `aria-pressed` must match. The current prototype's text-only selected treatment is not the final production specification.

## Preview

Run from the repository root: `node prototypes/desktop-v2/preview.mjs`

Open `http://localhost:3335/` (home) or `http://localhost:3335/#explore` (explore).

- Independent HTML/CSS/JS; existing Next.js routes and mobile UI are untouched.
- Reuses the repository's cover photos and SUIT font. Icons are generated from the installed Lucide library, matching the existing product.
- Search/category/region/sort use hash navigation; browser back/forward works.
- Saves and Hype are prototype-only localStorage entries, never production writes.
- Cards open existing map pages in a separate tab. No new map/place detail UI.
- Nine editorial maps are sample data. Counts and regional coverage are illustrative snapshots, not a live query. No fabricated popularity labels or new-map dates; the third home section uses “더 많은 테마” until a reliable publication date is available.
- Edit `index.html` for the shell, `styles.css` for appearance, `app.js` for sections/sample data/interactions.
