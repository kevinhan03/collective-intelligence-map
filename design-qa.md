# Mobile home reference implementation — 2026-10-04

Source visual truth: the three user-provided mobile screenshots in this conversation: image 3 (collapsed cards and search button), image 1 (expanded card), image 2 (expanded search). Source pixels: 945 × 2048 as displayed, originally 1179 × 2556. Compare app content, excluding status bar, with existing Ting map imagery and charcoal/lime palette as explicitly requested.

Implementation: http://localhost:3000/; Chrome browser viewport 393 × 852 CSS px. Browser captures are 378 × 819 raster px (browser capture scale ~0.962); reference is normalized conceptually by width to the same mobile content scale. Screenshots: `artifacts/mobile-home-reference/collapsed.png`, `expanded.png`, `search.png`. These are real browser captures with the four existing maps. Existing desktop QA is retained below.

## Mobile findings and comparison history

1. P1: inherited page width and grid min-content sizing pushed the cards beyond the right viewport edge. Fixed the mobile-home page width and grid column minimum; subsequent browser capture and 360/390/430/768px tests show no horizontal overflow.
2. P1: the global heavy heading font did not match the reference's light regular headings. Set the card title to the existing variable SUIT face at weight 400, approximately 24px at 393px, with reference-like line height and 28px inset. Revised capture has regular rather than heavy titles.
3. P2: reference imagery is dimmer than the initial implementation. Reduced image brightness and retained the soft inset edge illumination. `collapsed.png` shows the revised balance.
4. P2: the first search implementation contained a second filter row absent from the reference. Removed the row; `search.png` now shows a single floating pill with genuine backdrop blur, translucent fill and highlighted border.
5. P1 local-preview issue: the Next development indicator intercepted the bottom-left search button. Disabled that development indicator; compile/runtime error reporting remains available.

## Required fidelity surfaces

- Typography: thin regular title, white foreground, no secondary content on collapsed cards; existing Korean SUIT retained. The supplied titles are shorter than the reference article headlines, so their line wrapping differs intentionally.
- Spacing/layout: 8px outer inset, 9px card gaps, 40px corners, roughly 160px cover height at phone widths. Expanded image header flows into a 56px metadata strip and description body, with overlapping round close button. Body height follows the existing description rather than padding it to match the much longer sample article.
- Colors/tokens: dark imagery, charcoal page and expanded surfaces, lime navigation arrow/focus accent. The reference's white page and white description panel are intentionally mapped to this product's palette.
- Image quality: existing four map covers reused. No reference article photos copied and no new photo assets invented. Cover subject mismatch for the vintage map remains an existing asset limitation outside this change.
- Copy: only map name on collapsed cards. Open preview contains existing location, place count, description and follower count; map entry works via the second title tap or arrow.
- Glass: 22px backdrop blur with saturation, translucent fill, thin light border and inner highlights; image details blur visibly beneath the expanded search pill. Card edge treatment is a CSS surface effect, not a generated replacement for imagery.

Full-view evidence: compare the three supplied reference states with the corresponding implementation captures above. Focused regions: card title/radius/inset, expanded header-to-metadata junction and close button, search pill border and blurred image beneath it. These captures support a visual adaptation assessment, not a pixel-diff or identical-photo claim.

## Interactions and checks

- First tap opens inline preview without navigation; second title tap and arrow link navigate to the intended map. Close restores keyboard focus; Escape collapses the preview.
- Bottom search visible initially, hidden after scrolling down, restored on upward scroll. Real browser observations: down at y=260 → hidden, up to y=160 → visible.
- Search input autofocus, filtering, empty-result reset, Escape close and query retention checked. Keyboard viewport offset handling implemented; real iPhone software keyboard not tested.
- Full E2E suite: 22 passed, 15 intentionally skipped, 1 scroll test initially failed because it scrolled before the opening animation created a scrollable page. That test now uses a shorter viewport and reduced-motion preference; targeted rerun passed. All 23 applicable cases have passed across those runs.
- Typecheck, lint, 50 unit tests and production build passed. Browser error log empty during home/preview/search inspection. Desktop 1024/1440px regression checks passed.

## Follow-up polish / limitations

- Actual phone touch/keyboard and Safari rendering remain unverified; inspect on the user's phone before judging those surfaces final.
- Glow and glass are browser-rendered approximations of a screenshot, with intentional palette and image substitutions. No pixel-identical claim is made.
- No deployment performed.

Implementation checklist: [x] collapsed cards [x] inline preview [x] two-stage navigation [x] glass search [x] scroll direction behavior [x] responsive and desktop regression checks.

final result: passed

---

# Earlier desktop glass reference adaptation QA

Source visual truth: user screenshots dated 2026-09-11 22.12.39, 22.12.56, 22.14.13, 22.15.32, and 22.18.15 in /Users/kevin_han/Desktop.
Implementation screenshot: /tmp/collective-glass-desktop.png (1470 × 776 browser capture).
State: Tokyo Fashion map with two approved places; desktop. References are style references, not equivalent product screens: compare surface treatment rather than dashboard content or full-frame geometry. No pixel-exact cloning claimed.

## Comparison
- Typography: existing Geist and Korean fallback retained; white headings and lighter secondary text remain legible after background dimming.
- Layout: rounded outer frame, inset cards and floating filter bar adapt references 1/5. Existing desktop 20:80 split retained. Reference 3 informs consistent card gaps.
- Tokens: smoky blue-gray translucent panels replace opaque green-gray panels; lemon remains the action color. Inner highlight and thin borders define layers.
- Assets: generated photographic glass atmosphere at public/glass-atmosphere.png; no smart-home pictures or analytics content copied into the product.
- Copy: existing community and place content retained.
- Focused comparison: header text initially disappeared over a bright patch. Multiply backdrop treatment fixed this in the second capture. Place cards now have individually visible edges and consistent padding instead of undifferentiated rows.

## Verification
- Lint and production build passed.
- Existing desktop/mobile E2E: 6 passed (discovery, filters, detail, protected participation and Google login).
- Browser map capture inspected; console error list empty.
- Mobile screenshot comparison not performed; mobile interaction checks passed via E2E.

## History
1. Initial bright backdrop reduced header contrast (P1).
2. Applied dark multiply treatment; recaptured at same viewport. Header and description readable, glass illumination retained.

## Follow-up polish
- P3: consider per-theme editorial imagery in a future homepage iteration. Current scope adapts common surfaces and the map experience.

final result: passed
