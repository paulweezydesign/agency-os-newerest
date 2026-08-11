# Architecture

## Shape

AgencyOS is a **Next.js 15 App Router monolith** hosting Auth.js, MongoDB/Mongoose, and (upcoming) Mastra agents/workflows in one deployable unit. See ADR-0002.

## Auth

Auth.js v5 with a Credentials provider and expandable roles (`admin`, `agent-operator`, `client`). Operator sessions expose `role` and `tenantId` via `getSessionContext`. Dashboard routes are gated by `resolveDashboardAccess`.

## Data

MongoDB is the primary store (ADR-0001). `connectMongo` is a Next-safe singleton. Documents carry `tenantId`; v1 runs one tenant in practice.

## Clients

Tenant-scoped Client CRUD lives under `src/lib/clients` (Zod + service + mongoose repository). HTTP handlers in `/api/clients` use `resolveOperatorApiAccess` (operator allow; unauthenticated 401; non-operator 403). Thin dashboard UI at `/dashboard/clients`.

## Projects

Projects belong to a Client and are tenant-scoped under `src/lib/projects`. Create/list live at `/api/clients/[clientId]/projects`; get at `/api/projects/[projectId]`. Fields include `budget`, `timelineStart`, and `timelineEnd`. Dashboard: create/list on client detail; detail at `/dashboard/projects/[projectId]`.

## Next

Tasks + audit logs, the Project Manager agent, tracker mirrors, and policy gates — see `docs/plan.md` and `.scratch/agencyos-v1/issues/`.
