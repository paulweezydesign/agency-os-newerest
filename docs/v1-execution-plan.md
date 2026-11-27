# AgencyOS V1 execution plan

Date: 2026-11-07. Scope: a reviewable private-beta candidate, then one real-model internal delivery path. This is not a production rollout.

## Outcome

An authenticated agent operator can run one fixed fictional brief through the Project Manager (agent), inspect the resulting audited Task, and inspect one saved brief produced by a bounded Tech Lead teammate. MongoDB remains the system of record. The Project Manager orchestrates; the teammate writes the deliverable. A generated sentence is never evidence that a Task, artifact, or external action exists.

## Milestone 1: consolidate the tested candidate

Base the candidate on `integrate/30-durable-mastra-operator-ui` at `8c7eae394b97bb3f3d403a18b30fd6164310b531`. Preserve its durable Mastra suspend/resume, policy-gate safeguards, operator UI and repeatable isolated workflow demo. Apply only the five theme source/test files from PR #25 at `ae71e0467bf1a0407df0f07b793ebaf5c120802d`.

Do not merge PR #29 wholesale. Do not overwrite the tested integration with another foundation. Do not copy PR #25's stale release checklist or GitHub Actions configuration. The existing build already gates lint, typecheck, tests and compilation; CI changes remain a separate decision.

Acceptance:
- Fresh `npm ci`, lint, typecheck, ordinary tests and production build pass for the combined source.
- Dark default, light/dark persistence, keyboard toggle, focus, sign-in and operator-state readability work together.
- Existing lead scoring 39/40/69/70, approval/denial, duplicate-prevention and historical-gate regressions stay green.
- Report exact source ancestry, changed files and checks before remote publication.

## Milestone 2: add a bounded internal execution path

Add a separate non-streaming operator endpoint, not additional authority to the general agent chat. The feature defaults off. Requests bind an existing allowlisted synthetic Project to a versioned fixed fixture and a UUID; request bodies cannot select tenant, model, teammate, arbitrary prompt, recipient or output kind.

One additive AgentRun record binds tenant, Project, request identity, actor, fixture hash/version, model metadata, state, Task/artifact references and audit correlation. No migration or rewrite of existing records. Unique run/Project identity and durable admission prevent double execution. Read-only inspection remains the way to recover a lost HTTP response.

The Project Manager receives only a server-bound Task-creation capability. It cannot open GitHub PRs, spawn teammates, browse, send messages, move money, or synchronize trackers. It creates at most one Task assigned to Tech Lead. The teammate receives only the fixed fictional fixture and persisted Task; it produces one validated brief with no execution tools. Store the brief using the existing ProjectArtifact kind and link the Task and artifact through AgentRun.

Use an isolated persistence composition. Do not reuse the broad Project Manager getter, the Monday-wrapped Task service, the Slack-initializing Project getter, or the Research factory. Prompt instructions are not the capability boundary.

Acceptance:
- Authorize operator and tenant before initializing agents/storage; reject disabled and production execution.
- Reject extra fields, arbitrary prompts, unsupported models and non-synthetic Projects before model invocation.
- Exactly one bounded Project Manager invocation and one bounded teammate invocation; explicit timeout, token ceilings and no automatic provider retries.
- Commit Task + audit + run checkpoint atomically, then artifact + Task completion + audit + terminal run atomically.
- Fail closed if Mongo transactions are unavailable. Replica-set Mongo is a prerequisite, not a silent fallback to separate writes.
- Refusal, malformed output, timeout, missing Task, audit failure and persistence failure cannot become a successful run.

## Milestone 3: prove replay and failure behavior

First run offline with injected model doubles. Those tests verify control flow and persistence contracts, not real model reasoning or provider availability.

Test matrix:
- Anonymous, wrong role, wrong tenant, wrong Project, disabled feature, production, unverified Preview and missing configuration: zero model calls.
- Same UUID/same fixture, changed payload, another UUID on the same Project, parallel starts and lost response: no duplicate Task/artifact or model run.
- Repeated Task-tool invocation: return the stored Task or reject a conflicting proposal, never create another Task.
- Model refusal, unsupported tool, malformed/oversized output, timeout and provider failure: inspectable failure/uncertainty; no fabricated completion.
- Task/audit/artifact transaction failures: no partial successful checkpoint; no completed Task without artifact and audit.
- Crash after claim, during each model call, after Task commit and after final commit: retain a durable state. An ambiguous call is blocked, not automatically retried.
- Fresh process/database restart: inspect the same Task, artifact, run and correlation. No reset/delete-to-retry route.

## Milestone 4: live-model acceptance and review

Before a live test, explicitly select an existing approved provider and exact model, the synthetic fixture to send, an execution environment and a test spending cap. No credential creation or copying is part of this change. An existing legacy OpenAI fallback does not choose the provider for this path. NVIDIA NIM compatibility must be verified against the user's actual approved endpoint/model before wiring or use.

Use an isolated replica-set Mongo database and one fictional Project. Capture run/Task/artifact/audit IDs, model identity, measured usage, bounded execution outcome and a reload/inspection demonstration. Never export credentials, cookies, raw authorization headers or real client content.

Publication and deployment gates:
- Review the exact diff and final verification first. Source publication may trigger the repository's existing Preview deployments and must be tracked for the exact pushed SHA.
- A draft PR is review evidence, not merge or production approval.
- Protected Preview OAuth, runtime configuration, endpoint access, provider access and transaction capability must be tested on that Preview. Earlier deployment success does not prove these properties for a new SHA.
- No manual deployment, security setting change, new integration, production merge or promotion is included.

## Explicitly out of scope

Real client data; public onboarding; prospect scraping; live email/Slack/client invites; payments; SOW sending; GitHub writes by the product; Monday/Linear synchronization; multiple teammates; dynamic spawning; automatic retry of uncertain model calls; production enablement.

## Delivery sequence and dependencies

1. Candidate: source consolidation and checks. Independent of model credentials.
2. Agent path: default-off contracts, capability boundary, persistence and fake-model tests. Requires the additive schema design; does not require a provider call.
3. Durable proof: real replica-set Mongo concurrency/restart checks. Requires an isolated supported database runtime.
4. Live proof: approved provider/model/environment/budget and synthetic inputs. Do not call the feature done without this evidence.
5. Review publication: exact diff and test summary, then separately authorized source push/draft PR and exact-SHA CI/Preview checks. Human-owned merge and production remain separate.

At every checkpoint distinguish implemented, tested locally, tested against real Mongo, tested with a real model, and tested on protected Preview. None implies the others.
