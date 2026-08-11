# AgencyOS

Hybrid agency operating system: human CRM/PM for digital agencies, plus an internal AI agent workforce that delivers work under Project Manager orchestration.

## Language

**AgencyOS**:
The product — multi-tenant CRM/PM for human agency staff and clients, with an internal AI agent workforce.
_Avoid_: digital-agency (app folder nickname only), Agency OS as two words in docs

**Project Manager (agent)**:
The AI orchestrator that decomposes work, delegates to teammate agents, monitors progress, unblocks, and tie-breaks. It does not complete deliverable work itself.
_Avoid_: PM (ambiguous with human role), supervisor, conductor

**Teammate agent**:
An AI agent that executes assigned work (research, code, email, scaffolds, etc.) under Project Manager delegation.
_Avoid_: worker, subagent (unless referring to Cursor tooling), bot

**Human Project Manager**:
A person with the PM role in the agency tenant who supervises projects and approvals in the UI.
_Avoid_: Using "PM" alone when agent vs human is unclear

**Client**:
An organization the agency serves; owns projects and portal access.
_Avoid_: Customer, account (unless meaning auth account)

**Project**:
A scoped engagement for a Client with timeline, budget, tasks, and deliverables.
_Avoid_: Job, engagement (unless quoting SOW language)

**Task**:
A unit of work whose system of record is the internal AgencyOS database; Linear and Monday.com are synced mirrors; GitHub holds code/PRs linked by reference.
_Avoid_: Ticket (except when quoting an external tracker), Issue (except GitHub Issues)

**System of record**:
The internal AgencyOS database (MongoDB) for tasks and operational state; external trackers mirror it.
_Avoid_: Multi-master, dual-write without a primary

**Policy gate**:
A required human approval before an agent action that is client-facing or involves money (client email, invoice, SOW send). Internal/dev actions may proceed without that gate.
_Avoid_: Full autonomy, approve-everything

**Seed roster**:
The initial ten teammate agent roles (Project Manager, Tech Lead, Design, Research, Frontend, Backend, QA, Prospector, Nurture, Onboarding). The Project Manager may spawn additional specialized teammates when a gap appears.
_Avoid_: Fixed-only roster, no-roster

**Tenant**:
A logical agency workspace. Documents carry `tenantId` from day one; v1 runs a single tenant in practice.
_Avoid_: Workspace (except UI copy), organization (except Client org)

**Agent operator**:
A human Auth.js role that may run/supervise agents and approve policy-gated actions. Expands later toward the PRD’s finer human roles.
_Avoid_: Treating Auth.js’s three roles as the final RBAC model

**Tracker mirror**:
Linear and Monday.com copies of AgencyOS tasks. Status and assignee sync bidirectionally; scope and description stay AgencyOS-owned. GitHub holds code and PRs linked by reference, not task SoR.
_Avoid_: Treating Linear or Monday as system of record

**Spawn cap**:
At most **10 dynamically created** teammate agents per project (specializations beyond the seed roster), each logged with justification.
_Avoid_: Unlimited spawn in v1

**Deposit**:
A client payment recorded via Stripe Checkout to start or continue work; e-sign vendors are out of v1.
_Avoid_: DocuSign, Adobe Sign (deferred)
