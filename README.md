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

## Local durable workflow demonstration

See [the repeatable local demo](docs/local-workflow-demo.md) for `npm run demo:workflow`: isolated Mongo, existing local-demo sign-in, synthetic approval/denial and real Mastra resume, with browser and persisted evidence. The older `demo`/`seed` scripts run test stand-ins.

## OpenAI synthetic agent run

See [OpenAI provider setup](docs/openai-bounded-provider.md) to use your server-side API key with `gpt-6-astra` for the separate fictional Task-to-brief path. It is disabled by default, requires a Mongo replica set, and has no production or broad agent-chat integration.
