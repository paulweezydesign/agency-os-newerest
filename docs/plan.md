# AgencyOS — Implementation Plan

Living task board. Update status as slices ship. Decisions live in `CONTEXT.md` and `docs/adr/`.

## Product spine (locked)

| Decision | Choice |
| --- | --- |
| Product | **AgencyOS** — hybrid human CRM/PM + AI workforce |
| Conflict rule | Paul’s addendum wins over Blitzy body / PRD |
| Horizon | PRD **Phase 1** human surface + **full** AI workforce; Phase 2/3 deferred |
| PM agent | Orchestrates only (decompose, delegate, monitor, unblock, tie-break) |
| Teammates | **Execute** (research, code, email, scaffolds) |
| Policy gates | Client-facing + money → human **admin / agent-operator** approve |
| Data | **MongoDB only** (app + memory + vectors) |
| App shape | **Mastra-in-Next** monolith |
| Auth | Auth.js; 3 roles now, expandable toward PRD roles |
| Tenancy | `tenantId` on documents; **one tenant** in practice |
| Task SoR | Mongo; Linear/Monday mirror **status + assignee**; GitHub = code/PRs |
| Agents | Seed **10** + dynamic spawn **cap 10**/project |
| Code | Agents open **branches/PRs** on client repos; **humans merge** |
| Nurture | Prospector/Nurture **in v1** |
| Money kickoff | **Stripe deposits**; e-sign deferred |
| Deploy | Node 20+ + Atlas; host unspecified |
| Quality | TDD; lint/typecheck/test/build gates per slice |

## Status legend

`todo` · `in_progress` · `blocked` · `done`

---

## Slice A — Foundation

**Status:** `done`

- [x] Next.js 15 App Router + TypeScript + Tailwind v4
- [x] shadcn/ui init (`components.json` + Button; Tailwind v4)
- [x] Mastra (`@mastra/core`) stub wired in `src/mastra` (empty agents/tools/workflows; `@mastra/rag` deferred)
- [x] MongoDB singleton + Mongoose; `tenantId` on session/data path
- [x] Auth.js v5 skeleton: `admin`, `agent-operator`, `client`
- [x] `.env.example`, README stub, `docs/architecture.md` stub
- [x] Test harness (unit) green on empty smoke

**Exit:** app boots, auth session works, Mongo connects, CI scripts exist.

Note: Ticket 01 auth shell + Slice A leftovers (Mastra stub + shadcn Button). `@mastra/rag` deferred until Slice G.

---

## Slice B — Clients / Projects / Tasks + audit

**Status:** `done`

- [x] Models: Client, Project, Task, AgentActionLog (Conversation later)
- [x] Zod contracts + Client/Project/Task APIs (RBAC)
- [x] Dashboard clients/projects + task board UI
- [x] Correlation IDs on Task mutations (`x-correlation-id` → AgentActionLog)
- [x] Unit + API handler tests for Client/Project/Task + RBAC denial + audit writes

**Exit:** operator can CRUD clients/projects/tasks; actions auditable.

Note: Tickets 02–04 shipped Client → Project → Task board with action audit.

---

## Slice C — Project Manager agent + tool bus

**Status:** `todo`

- [ ] `project-manager` agent: delegate-only instructions + output contracts
- [ ] Mongo tools (scoped CRUD) with Zod + retries/timeouts
- [ ] Every tool call → AgentActionLog
- [ ] Streaming chat route `api/agents/[name]/chat`
- [ ] AgentChat UI (operator)

**Exit:** PM can read/write domain state via tools; no silent tool use.

---

## Slice D — GitHub link + PR workflow

**Status:** `todo`

- [ ] GitHub tools (Octokit): repo link, branch, commit, open PR
- [ ] Project ↔ repo binding in Mongo
- [ ] Policy: agents may PR; merge left to humans / branch protection
- [ ] Integration tests with mocked Octokit

**Exit:** teammate (or PM-assisted flow) opens a PR on a linked repo from a task.

---

## Slice E — Linear + Monday sync

**Status:** `todo`

- [ ] Outbound sync: AgencyOS task → Linear + Monday (create/update)
- [ ] Inbound webhooks: status/assignee → Mongo
- [ ] Scope/description edits from trackers ignored (or parked as comments)
- [ ] Sync conflict log + operator visibility
- [ ] Tests for mapping + conflict rules

**Exit:** status/assignee round-trip; scope remains AgencyOS-owned.

---

## Slice F — Seed roster + policy gates + spawn

**Status:** `todo`

- [ ] Seed agents: tech-lead, design, research, frontend, backend, qa, prospector, nurture, onboarding (+ PM from C)
- [ ] Per-agent tool scopes + safety rules
- [ ] Policy-gate service: client email, SOW send, invoice/deposit → approve queue
- [ ] Dynamic spawn tool with **cap 10**/project + justification in action log
- [ ] Operator UI: approve/deny gated actions

**Exit:** full seed roster runnable; gated actions block until approved; spawn enforced.

---

## Slice G — Agency skills + Exa/Resend + client pipeline

**Status:** `todo`

- [ ] Tools: `createProjectBrief`, `generateSOW`, `buildMVPScaffold`
- [ ] Workflows: `agency-delivery`, `client-pipeline` (lead score branching), plus stubs for lifecycle/sprint/code-review as needed
- [ ] Exa search tools; Resend email tools (client sends gated)
- [ ] Persist brief/SOW/scaffold on Project; show on project detail
- [ ] RAG ingest/query baseline for Research (`text-embedding-3-small`, source attribution)
- [ ] Integration tests for delivery + pipeline happy paths

**Exit:** demo path lead → qualify → nurture → onboard → brief → SOW → scaffold with logs.

---

## Slice H — Client portal + Phase 1 human surfaces

**Status:** `todo`

- [ ] `(portal)` routes: status, approvals, artifacts (client role)
- [ ] Design review (upload/annotate path; Figma deep-link later in I)
- [x] Budget guardrails (80/100/120% alerts) on Project
- [ ] Change requests + UAT checklist (Phase 1 core)
- [ ] Expand permission map toward PRD roles (without Auth0 yet)
- [ ] Tests for portal RBAC + approval state machine

**Exit:** client can review/approve; agency sees budget burn; CR/UAT paths work without e-sign.

---

## Slice I — Figma + Slack + Stripe

**Status:** `todo`

- [ ] Figma integration for design review
- [ ] Slack notifications for gates, sync failures, budget alerts
- [ ] Stripe Checkout deposits; invoice hooks as Phase 1 allows
- [ ] Policy gates on money movements
- [ ] Webhook verification + tests

**Exit:** Phase 1 “essential” human integrations complete atop Paul-first set.

---

## Slice J — Harden

**Status:** `todo`

- [ ] Unit/integration/smoke coverage for critical workflows
- [ ] Retries/timeouts/circuit breakers audited on all external APIs
- [ ] Observability: correlation IDs end-to-end; runbooks
- [ ] `docs/architecture.md`, `docs/workflows.md`, `docs/runbooks.md` complete
- [ ] Seed script + demo script
- [ ] `lint` / `typecheck` / `test` / `build` all green

**Exit:** Definition of Done from build-prompt met for the locked spine.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Phase 1 human scope + full AI org is large | Ship A→G before expanding H; keep Phase 2/3 out |
| Mongo-only multi-tenant later | `tenantId` everywhere; revisit RLS-class isolation if needed |
| Dual tracker sync conflicts | Narrow bidirectional fields; log rejects |
| Agent cost / spawn sprawl | Cap 10; action-log justification; policy gates |
| PRD e-sign gap | Stripe deposits; document manual sign process in runbook |

## Progress log

| Date | Note |
| --- | --- |
| 2026-08-11 | Plan created from grill-with-docs; decisions in CONTEXT.md + ADR-0001…0005 |
| 2026-08-11 | Ticket 01: Auth shell + tenant dashboard shipped (tests/lint/typecheck/build green) |
| 2026-08-11 | Ticket 03: Project under Client (timeline + budget) shipped; 36 tests green |
| 2026-08-11 | Ticket 04: Tasks + AgentActionLog audit; Slice B done; 43 tests green |
| 2026-08-11 | Ticket 16: Budget guardrails (spend + 80/100/120 alerts); tests green |
