# Participation policy (2026-09-12)

- Every signed-in, non-suspended member can search for and propose places. Existing request limits and provider budgets still apply.
- A proposal needs a selected place and a short theme-specific reason (5–1000 characters). Submitting returns to the Theme Map with a pending-review notice.
- All proposals, including administrator submissions, remain pending until an administrator approves them. Pending places stay private.
- Approval, rejection and duplicate merging require the private database administrator role. Public clients cannot create or edit Theme Maps; map creation remains an operator workflow.
- Members can record a visit, operating status, or a request to check closure/relocation. The latest response per member and map-place replaces the previous response. Public summaries cover the last 90 days.
- These observations never automatically hide a place. Administrators review them alongside negative theme-fit votes, using the moderation filters and search.
- Google Places is not called for observations or moderation summaries.

Verification: `npm run check`, `npm run test:db`, `npm run test:e2e`. Database tests check member proposals stay pending, unauthorized approval/map creation fails, and verification responses replace rather than inflate counts.
