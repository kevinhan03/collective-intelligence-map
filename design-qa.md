# Place participation UI verification

final result: passed

Scope: implement the user's accumulated place-detail and comment-flow changes in the existing application. This is a functional adaptation of the selected mockups, retaining the application's real photographs, attribution, photo upload and moderation controls.

## Visual evidence

- Detail source: `/Users/kevin_han/.codex/generated_images/01a144dd-2e25-7ba3-842d-96f468f5b38f/exec-2a17eb6e-92a6-4614-bf87-9771ece3dfcc.png`
- Comment source: `/Users/kevin_han/.codex/generated_images/01a144dd-2e25-7ba3-842d-96f468f5b38f/exec-70392d9a-1819-4f06-83ef-789e536cf148.png`
- Live detail capture: `artifacts/participation/detail-mobile.png`, 485 × 722 pixels / CSS viewport 485 × 722.
- Empty thread: `artifacts/participation/comments-empty-mobile.png`, 485 × 722.
- Populated thread, isolated in-memory fixture: `artifacts/participation/comments-list-mobile.png`, 500 × 722.
- Narrow detail with long title: `artifacts/participation/detail-320.png`, 320 × 740.
- Desktop fixture: `artifacts/participation/comments-desktop.png`, 1440 × 1024. This standalone fixture omits the real application's parent map grid; it verifies interactions and overflow, not desktop panel width.
- Same-input visual comparisons: `artifacts/participation/detail-comparison.png` and `artifacts/participation/comments-comparison.png`. Both were opened and inspected. Source images were downsampled proportionally into the corresponding CSS-size frame with contain/padding, without stretching. Implementation captures are 1 image pixel per CSS pixel. Original generated sources are 1024 × 1536.
- Important controls and typography remain readable in these comparisons, so an additional magnified region was unnecessary.

## Findings and accepted differences

No outstanding P0/P1/P2 findings within the requested scope.

- Typography: existing SUIT retained. Place title 20px; intro body retains existing 15px mobile style; participation question and comment body 14px. Long titles wrap while save and close retain their own 44px targets. Long map names wrap independently of reaction counts.
- Layout: introduction → compact reaction row → comment preview → photographs → stations. No repeated content dividers. Intro menu is inside its surface; bookmark sits immediately left of close. No bottom save/directions bar. Directions is inside the station section, including unsupported/error station states.
- Color: existing charcoal/navy surface and lime selected states retained. Olive introduction surface follows the user's supplied reference. Comment preview has a distinct subtle surface; icon reactions have no visible button containers.
- Assets: real existing place photographs retained. User avatars render when available; initials/person fallback is used for profiles without an avatar. No generated mock photographs or invented user data were added to the product.
- Copy: introduction title removed; dynamic `{mapTitle}에 어울리는 장소인가요?`; section called `댓글`; no preview pagination dots.
- Comments: a dedicated mode in the same panel with a fixed composer, back action and right-aligned fixed-width likes. At 500px all five tested likes had identical x=436 and row-relative y=0. At 320px all five had identical x=264 and y=0; no horizontal overflow; composer ended at the viewport bottom.
- Source mocks use shortened descriptions, illustrative counts and two compact photo thumbnails. The live screen has real attribution/help text and the existing upload/photo viewer. This increases its intro/photo height and puts stations below the fold. These existing functional surfaces are intentionally retained; the user requested their actions and styling to change, not their information to be removed.
- Populated-comment comparison uses a long-title fixture and mock network responses. Live service has no comments for the inspected place; its empty state was verified separately.

## Comparison and correction history

1. Browser verification found that returning from comments could change detail scroll offset (294 → 55). Added an explicit offset snapshot before entering comments and restoration before restoring focus.
2. Retested against the live service: 294 → comments → back → 294. Final detail capture was taken after this fix. Layout remained unchanged.

## Interaction and validation evidence

- Live browser: intro menu → add form → cancel; detail → comments → back; save/un-save, then original saved state restored; station directions placement; footer removal; compact reactions.
- Isolated browser fixture: four comments → like/unlike; submit fifth comment; count and list update; input clears; long text and fixed reaction column; 320px, 390px and desktop layouts.
- Browser log review: recent live logs contained development refresh messages, no observed runtime error in the verified flow. Initial local fixture encoding error was fixed before interaction testing.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 42 files / 139 tests passed, including new thread API authorization/input tests.
- `npm run test:db`: passed; includes pagination past 30, idempotent likes, unlikes, public totals/private identities, anonymous write denial, hidden/introduction comment denial and no public SECURITY DEFINER functions.
- `NEXT_TEST_BUILD=true npm run build`: passed.
- `git diff --check`: passed.
- Regression browser test added/updated in `tests/e2e/workflows.spec.ts`; the full automated Playwright suite was not run in this session. Browser interaction checks above used CUA.
- Remote additive migration applied through the project's existing database connection after isolated DB tests passed. Functions, RLS and a public thread read were verified. Application deployment was not performed.

## Follow-up polish

- Retained small report/delete actions add some height versus the purely visual mock. Moving these to per-comment menus can be considered separately.
- Native mobile keyboard behavior uses the existing visualViewport panel sizing; no physical-phone keyboard test was performed.

## Follow-up: share placement, attribution menu, adaptive copy, station disclosure

final result: passed

The user's subsequent instructions supersede the earlier mock's menu position and station presentation. Source evidence is the newly supplied introduction screenshot plus the explicit requested changes. Final browser capture: `artifacts/participation/detail-refined-390.png` (390 × 844 CSS/image pixels).

- Header order verified as share → save → close. The same ShareButton handler remains in use; desktop keyboard activation displayed `링크를 복사했어요.`. Sharing was removed from More.
- Introduction menu is now the attribution row's trailing control, not positioned over the introduction text. Main paragraph can use the complete width.
- Both contextual sentences render complete with nowrap and measured font fitting. At 390px the helper used 11.98px (308.98px of 310px available) and the question used 13.06px (243.23px of 244px available). At 320px they used 9.58px / 10.49px and stayed within available width, with no page overflow. Font size grows again as width grows, capped at each sentence's intended normal size. No ellipsis or text truncation is used.
- Stations use native details/summary with default closed state. Keyboard activation exposed the actual station list; activating again closed it. Directions stays alongside the summary independently of open state. This supersedes the earlier always-open layout.
- Final screenshot inspected for typography, grouped spacing, original charcoal/olive/lime tokens, real photograph fidelity, full copy and header icon alignment. No actionable P0/P1/P2 issue remains for this follow-up.
- Typecheck, lint, isolated production build and 139 unit tests passed. Existing browser regression coverage was extended for header sharing, native disclosure and adaptive text; full automated Playwright suite was not run.
- Recent browser log inspection returned no errors. No additional database or deployment changes were made for this follow-up.

## Follow-up: content-sized mobile summary card

Visual result: passed.

- Source: user's screenshot of excess space below participation actions on a no-photo place.
- Track now measures the selected summary with ResizeObserver; off-screen descriptions no longer set its height. Photo load/empty/error and viewport changes remeasure it. Vertical overflow remains inside the selected slide on short screens.
- Reduced summary/slide bottom spacing. Measured action-row-to-footer gap is 8px, plus 6px footer top inset (14px to its interactive content).
- Verified La Cruda with no photos at 650px and 390px; photo card expanded to 415px at 650 × 844; at 390 × 600 it caps at 312px, with a 160px scrollable slide and 263px content, keeping footer inside the viewport.
- Initial resize/rapid-navigation check exposed native scroll-snap restoring an older slide after programmatic alignment. Native snapping was removed in favor of the existing JS nearest-slide settlement/custom swipe. Pending selection timers are canceled while aligning. Retested selected title/body agreement, x=0 active slide alignment, delayed stability and actual horizontal drag to the next place.
- Final capture: `artifacts/participation/preview-compact-final.png`, 390 × 600. Real place data/photo/no-photo states were used. No runtime errors observed in this verification flow.
- Lint passed; all 143 unit tests passed. Typecheck/build are blocked by two unrelated errors in the concurrently added `tests/unit/external-search-limit.test.ts` at lines 97 and 99 (`name`, `externalLimit`). That test and associated search changes were not modified for this card fix. Application compilation itself succeeded before the typecheck gate failed.

## Follow-up: quiet mobile saving and summary header action

Visual result: passed.

- Removed mobile save success/undo notice; desktop notice and save failure feedback remain available.
- Summary-card bookmark moved from footer to the header, immediately before close. Badge wrapper removed. Browser computed border=0px, transparent background; 44px hit target retained.
- Browser checked saved → unsaved → saved, restoring the original saved state. Unselected SVG fill=none and selected fill=currentColor; no `.save-notice` rendered on mobile.
- Typecheck, lint and diff whitespace checks passed for this follow-up. No DB changes required.

## Follow-up: comment empty state and per-comment actions

Visual result: passed.

- Per user instruction, panel height remains unchanged. Empty state now centers a restrained message icon, heading and place-specific experience question inside the existing list area. Initial browser comparison exposed an older mobile display:block rule overriding the empty flex layout; narrowed it to non-empty lists and recaptured. Post-fix center deviation was 2px.
- Place subtitle uses muted foreground rather than lime.
- Disabled send is a muted arrow without a filled circle; valid input activates its existing lime background. Verified by typing into a separate no-comment place, then clearing without submitting. No real comment was posted or deleted.
- Moved delete/report into accessible Radix per-comment menu on the author line; only the author sees Delete. Opened the current user's real comment menu and verified Delete/Report, then dismissed it. The right-side like column stays in the same place, with no action links beneath the body.
- Captures: `artifacts/participation/comments-refined-empty.png` (390 × 844) and `artifacts/participation/comments-refined-menu.png` (populated live thread). Existing real avatar/initials fallback and comment content retained.
- Typecheck, lint, production build and all 143 unit tests passed. Browser regression scenario extended for the new comment menu; full Playwright suite was not run. No backend changes required.
