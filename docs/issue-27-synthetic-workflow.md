# Synthetic lead workflow

This implementation continues draft PR #30 from commit `bda120c034980718d2bab6b86430f4f7037fe7bc`. PR #29 was also inspected and had no changed files. No competing PR was created.

## Operator flow

The existing authenticated Client create/read path persists the fictional organization and its `.test` contact email in MongoDB. Set `AGENCYOS_DRY_RUN_WORKFLOW=true` only for local development or a protected Vercel Preview. The feature is disabled by default and rejects Vercel Production and non-Vercel production mode.

Create a new Client such as `Example Test Agency`, email `lead@example.test`. On its detail page, use **Synthetic workflow**. Scores 39, 40, 69 and 70 route to disqualified, nurture, nurture and onboard respectively. A qualifying lead produces one pending human approval. The existing approvals page supports approve, deny and explicit recovery of an approved dry run.

One immutable workflow run is permitted per Client. Create another synthetic Client to test another score. Reuse the same run ID after a lost response. The form retains its request in session storage; the database remains authoritative. Existing GitHub allowlists and role checks are unchanged.

The workflow atomically reserves the Client with `workflowRunId` before scoring it. Legacy pipeline writes require that reservation to be absent. If a legacy write wins first, the workflow returns a conflict before creating any approval gate; if the workflow wins, the legacy API returns HTTP 409 and directs the operator to resume the saved run. Interrupted setup can safely acquire the same reservation on retry.

Authenticated API:

```text
POST /api/clients/:clientId/workflow
{"runId":"<UUID>","leadScore":70}

GET /api/clients/:clientId/workflow?runId=<UUID>

POST /api/policy-gates/:gateId/decision
{"decision":"approve"}
{"decision":"deny"}
{"decision":"recover"}
```

The server derives tenant and operator from the session and correlation ID from the run ID. Client ownership is checked in MongoDB. Workflow inputs cannot override the saved email. Missing or non-`.test` email is rejected before workflow execution. Denial and pending approval produce no effect.

## Execution and recovery

The registered Mastra `clientPipeline` workflow (ID `client-pipeline`) executes three actual steps: persist input, call existing scoring/routing services and request approval, then persist the approval boundary. These are deterministic service steps; no LLM or teammate execution is claimed.

MongoDB stores the immutable input, Client ID, run ID, Mastra run ID, correlation ID, checkpoints, status and result. Mastra engine memory is ephemeral; recovery uses these application checkpoints and safely reenters the bounded workflow. No claim is made that a Mastra storage adapter persists arbitrary engine snapshots.

Workflow results are historical snapshots. The returned top-level `gates` contain current decisions and effect state. Reading or replaying a run reconciles completion after denial or successful dry-run approval. A lost result checkpoint can rerun the deterministic route; the tenant-scoped request key prevents a second gate. Audit records retain the original correlation and record the operator performing reentry.

Approval and denial compete on one atomic Mongo conditional update before any effect begins. Generic adapters execute only for the winning approval. A generic effect failure is marked `unknown` and cannot be retried automatically because external acceptance may be ambiguous.

For dry runs, writing the receipt inside the approval document **is the effect**. Its atomic conditional update records one stable receipt and completion together. Concurrent recovery or response loss cannot create a second receipt. A failed write remains explicitly recoverable. All dry-run approvals bypass provider adapters and notifications, including when approved through the general approval endpoint. No external delivery or payment is tested or enabled.

## Schema

Approved additive changes: optional Client `workflowRunId`; PolicyGate `dryRun`, `requestKey`, `effectStatus`, `effectError` and `effectReceipt`; partial unique `{tenantId,requestKey}` index; `ClientPipelineRun` collection with unique `{tenantId,runId}` and `{tenantId,clientId}` indexes. Existing Clients remain unreserved and existing gates map to compatible defaults. Index initialization is awaited before accepting retryable requests. Index installation errors fail closed.

## Reproducible verification

Run an isolated local MongoDB server with a persistent data directory. Tests refuse a nonlocal Mongo address or a database name without `test` and retain fictional fixtures under unique tenant IDs.

```powershell
npm ci --no-audit --no-fund
npm run lint
npm run typecheck
npm test
$env:MONGODB_TEST_URI='mongodb://127.0.0.1:27027/agencyos_issue27_test'
npm test -- src/integration/client-pipeline-mongo.test.ts --maxWorkers=1
Remove-Item Env:MONGODB_TEST_URI
npm run build
```

The Mongo integration suite is explicitly skipped when `MONGODB_TEST_URI` is absent. It uses actual Mongoose repositories and real Mastra runs. It also launches a fresh Node/Vitest process to replay a saved run. `scripts/verify-mongo-persistence.mjs` reads Client/run/gate/audit evidence from another process; the acceptance report records a separate clean mongod shutdown/restart against the same disk data.

Verified locally on November 4, 2026: `npm run build` passed its lint, typecheck, 263 ordinary tests and Next.js build; the opt-in real Mongo suite passed 22 tests. Fresh-process workflow replay also passed after clean MongoDB shutdown/restart, preserving the Client reservation and exactly the same dry-run receipt. The four originally failing workflow/legacy write regressions now pass. Mastra emitted a dynamic-dependency build warning.

A separate local HTTP smoke passed 18 checks through Next.js with actual Auth.js local-development sessions: operator intake, workflow70, concurrent approval200/409, retry409, completed read with unchanged receipt, legacy409, anonymous401 and client-role403. Demo authentication was enabled only in that temporary development process; no provider credentials were supplied. Both local test servers were stopped afterward.

Protected Preview browser smoke and live GitHub OAuth remain separate acceptance checks. Local verification does not establish a successful live GitHub OAuth handshake. The user approved publishing this implementation to existing PR #30 and its triggered Vercel Preview deployments. Merge and Production rollout require a separate decision.
