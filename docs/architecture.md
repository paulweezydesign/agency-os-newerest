# Architecture

## Shape

AgencyOS is a **Next.js 15 App Router monolith** hosting Auth.js, MongoDB/Mongoose, and Mastra-ready agent seams in one deployable unit. See ADR-0002.

## Auth + portal

Auth.js v5 Credentials provider with roles `admin`, `agent-operator`, and `client`. Operators use `getSessionContext` + `resolveDashboardAccess` for `/dashboard`. Clients use `resolvePortalAccess` for `/portal` (seed `clientId` binding). Middleware redirects mismatched roles.

## Data

MongoDB is the primary store (ADR-0001). `connectMongo` is a Next-safe singleton. Documents carry `tenantId`; v1 runs one tenant in practice. Several delivery surfaces (design reviews, in-memory Slack/Figma/Stripe clients) use in-memory repositories for the demo path until persistence is swapped in.

## Domain modules (`src/lib`)

| Area | Responsibility |
| --- | --- |
| `clients` / `client-pipeline` | Tenant Client CRUD + lead-score branching (prospect → qualify → nurture/onboard) with gated Resend |
| `projects` / `tasks` / `agent-action-logs` | Engagement SoR, task board, correlation-id audit trail |
| `project-artifacts` | Brief → SOW → MVP scaffold; SOW send is policy-gated |
| `policy-gates` | Human approve/deny for client email, SOW send, invoice/deposit |
| `linear` / `monday-sync` | Tracker mirrors (AgencyOS tasks remain SoR) |
| `github` | Repo bind + agent open-PR (no merge) |
| `exa` / `rag` | Research search + ingest/query tools |
| `design-reviews` / `figma` | Asset URL and/or Figma deep-link; portal annotate/approve/reject |
| `change-requests` / `uat` | CR impact + dual approve; UAT checklist sign-off (no e-sign) |
| `slack` / `stripe` / `email` | Ops notifications, Checkout deposits + webhook, Resend |
| `http/with-retry` | Shared timeout + exponential backoff for external calls |
| `demo` | Seed + demo path runners (`npm run seed` / `npm run demo`) |

## UI surfaces

- `/dashboard` — agency operators (clients, projects, tasks, gates, artifacts, design reviews)
- `/portal` — client status, artifacts, design review decisions
- `/api/*` — thin route handlers calling `*-api.ts` handlers with RBAC

## ADRs

See `docs/adr/` (Mongo SoR, Mastra-in-monolith, tracker sync, agent PR not merge, defer e-sign / Stripe deposits, Figma deep-link).
