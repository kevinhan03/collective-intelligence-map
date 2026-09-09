# MVP implementation contract

Source of truth: `../collective-intelligence-map-product-plan.md` (read in full). User approved the detailed plan on 2026-09-10.

Theme Map is a public topic community; MapPlace is the unit of relevance. Launch wedge: Tokyo Fashion only. No personal maps, social graph, itinerary, unrestricted community creation, AI recommendation, tiles/POI ingestion, payments or chat.

Implementation: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase Auth/PostgreSQL/PostGIS/Storage. Vercel-ready. Search is server-only: internal DB → provider router → Kakao/Google → canonical resolver. Rendering is independently replaceable.

Stages: foundation; schema/RLS; auth/profile; community discovery/map; proposal/providers; votes/comments/saves/follows/reports; moderation/budgets; integrated verification.

External content is ephemeral and never promoted by copying it into canonical data. Independent place field provenance is required before approval. All browse/community actions operate without Places calls. Provider REST secrets never enter browser bundles; domain-restricted renderer keys are public by design.

Seed: one real community, no fabricated live votes/users. Isolated fictional demo fixtures for keyless UI preview; production seed has no invented venues. Curators must supply independently sourced real venues before launch.

Each stage: report changes, run instructions, tests, next step. No remote production database changes or public deployment during local implementation.
