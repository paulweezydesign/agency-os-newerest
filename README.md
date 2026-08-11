# AgencyOS

Hybrid agency CRM/PM with an internal AI agent workforce (Mastra-in-Next + MongoDB).

## Setup

```bash
cp .env.example .env.local
# start MongoDB locally, then:
npm install
npm run dev
```

Seed sign-in accounts:

- `admin@agencyos.local` / `admin-dev`
- `operator@agencyos.local` / `operator-dev`

## Scripts

- `npm run dev` — Next.js dev server
- `npm run test` — Vitest unit/smoke tests
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint
- `npm run build` — production build

## Docs

- `CONTEXT.md` — domain glossary
- `docs/plan.md` — living implementation board
- `docs/architecture.md` — architecture notes
- `.scratch/agencyos-v1/issues/` — tickets
