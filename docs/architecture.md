# Architecture

## Shape

AgencyOS is a **Next.js 15 App Router monolith** hosting Auth.js, MongoDB/Mongoose, and (upcoming) Mastra agents/workflows in one deployable unit. See ADR-0002.

## Auth

Auth.js v5 with a Credentials provider and expandable roles (`admin`, `agent-operator`, `client`). Operator sessions expose `role` and `tenantId` via `getSessionContext`. Dashboard routes are gated by `resolveDashboardAccess`.

## Data

MongoDB is the primary store (ADR-0001). `connectMongo` is a Next-safe singleton. Documents carry `tenantId`; v1 runs one tenant in practice.

## Next

Tickets after the auth shell add Clients/Projects/Tasks, the Project Manager agent, tracker mirrors, and policy gates — see `docs/plan.md` and `.scratch/agencyos-v1/issues/`.
