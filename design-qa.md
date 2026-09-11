# Glass reference adaptation QA

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
