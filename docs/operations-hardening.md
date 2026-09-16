# Search operations

Gemini reservations: 30 per user per hour, 1,000 globally per UTC day.
Geocoding reservations: 60 per user per hour, 2,000 globally per UTC day.
Reservations commit before the network request; failed upstream calls also consume a slot.
These are request caps, not currency budgets. Provider billing limits still apply.
Only the service role may reserve. Counters older than two days are removed on reservation.
Translation cache entries expire logically after 30 days and refresh on their next use.
Missing API keys and upstream failures never write empty cache entries.

## Migration release procedure

Run `npm run test:db`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` before release.
Apply additive DB changes before deploying dependent application code.
Production migration history was reconciled on 2026-09-16. `supabase migration list`
shows the same versions locally and remotely through `20260916143000`.
For a later manual incident, first compare production schema and local migrations before repair.
Do not mark a migration applied merely because a filename exists locally.
New migrations must be tracked in Git; never edit an already recorded migration during a later release.

## Remaining operational decisions

- MapTiler geocoding result persistence rights have not been verified for this account.
  Do not describe this as resolved by application code or by an environment flag.
  References: https://www.maptiler.com/terms/cloud/ and https://github.com/maptiler/maptiler-client-js .
  Cloud terms contain a geocoding bulk-download exception, while the client README prohibits
  storing/redistributing API results. Account-specific usage needs clarification, not a blanket claim.
- The browser suite currently uses demo data. Authenticated external-provider and approval flows
  still require an isolated staging Supabase project and test accounts before CI automation.
- Pending pins are intentionally publicly readable in published maps. Approval actions remain admin-only.
- CSP currently protects embedding, base URLs, and plugin objects. Script allowlisting requires
  a separate compatibility rollout for Next inline scripts and third-party map resources.
