# Synthetic lead workflow

Integration foundation: PR #30 at `16d4228d3f216218e1473177d44f1e42e4235e71`. Selected operator UX and Mongo engine patterns come from `cb367cd54ec938c09a3a1c79ee32579a24159e9e`; neither branch was merged wholesale. PR #30's reservation and receipt services remain authoritative.

## Operator flow

Enable `AGENCYOS_DRY_RUN_WORKFLOW=true` or the compatible `AGENCYOS_BETA_WORKFLOW=dry-run` only in local development or protected Vercel Preview. Both reject Vercel Production and non-Vercel `NODE_ENV=production`. The default is disabled. No deployment environment was changed by this integration.

Create a fictional Client with a saved `.test` email, then use its **Client pipeline** form. Scores 39, 40, 69, 70 route to disqualified, nurture, nurture, onboard. The enabled form never falls back to the legacy pipeline endpoint. It retains only a UUID and score, with a version marker, in tenant/Client-scoped local storage before sending. Repeated clicks, lost responses and reload retain the same identity. Browser Web Locks serialize cooperating tabs. Missing/corrupt storage fails closed while mounted; full browser-storage deletion does not remove the server reservation.

One immutable workflow run is permitted per Client, including after completion. Create another synthetic Client to test another score. Inspect the saved run, follow its gate link, approve/deny or explicitly recover an approved dry run, inspect again, and resume. Approval alone is not permission to resume: a dry-run approval requires successful completion and the matching stable receipt. Unknown generic effects and old claimed/uncertain records remain blocked.

## API and authority

```text
POST /api/clients/:clientId/workflow
{"operation":"start","runId":"<UUID>","leadScore":70}
{"operation":"inspect","runId":"<UUID>"}
{"operation":"resume","runId":"<UUID>"}

GET /api/clients/:clientId/workflow?runId=<UUID>

POST /api/policy-gates/:gateId/decision
{"decision":"approve"}
{"decision":"deny"}
{"decision":"recover"}
```

Omitting operation retains PR #30's start request compatibility. Session authorization precedes storage. Tenant and actor come from the session; correlation derives from run ID. Reads and resumes also verify Client identity. The browser cannot authorize resume with an approval boolean or replace saved score/email. No credentials or contact data are stored by the workflow UI.

PR #30's unique tenant/run and tenant/Client indexes, Client-document reservation and guarded stage updates are unchanged. Every legacy pipeline write competes on reservation absence at database write time, including an already in-flight request. Gate deduplication preserves the tenant/requestKey `client-pipeline:<runId>` and existing random IDs/receipts.

## Actual engine persistence

The registered `clientPipeline` (engine ID `client-pipeline`) runs persist-input, score/route/request, persist-approval-boundary, and human-approval steps. Deterministic domain stages do not claim LLM or teammate execution. The engine uses `@mastra/mongodb` 1.16.0 and the same database as the application. Execution through the unconfigured in-memory registry is rejected before domain work.

The existing `ClientPipelineRun` admission receives optional `engineVersion` and `engineState` fields. New admissions start at version1/idle. A Mongo compare-and-set claims idle->running for start or suspended->running for resume. There is no lease expiry or automatic replay of a claimed invocation. Admission and engine-store writes request majority/journal durability.

The human-approval step truly calls Mastra suspend. Resume restores its Mongo snapshot and rechecks authoritative gate decisions. Only a matching persisted suspended/success snapshot permits admission suspended/success. Gate completion alone never establishes engine success. Engine snapshots and admission updates are separate writes: any unconfirmed window remains running/uncertain and blocked, rather than replaying effects. A committed admission success followed by response loss is safely inspectable. Orphaned gates are exposed by tenant/requestKey if the application checkpoint was lost.

Old PR #30 checkpoint-only admissions without engineVersion/state remain inspectable but are not silently converted into resumed engines. Old operator-branch executionState claims are conservatively blocked in decisions and recovery; no claim is overwritten. No database migration, index deletion, or production data edit is included. Do not run mixed historical writers against these records as an integration-validation substitute.

## Fake effects and recovery

Approval/denial still compete on PR #30's pending-only conditional write, now also excluding historical executionState records. For dry runs, the one-document receipt/completion write **is the effect**. Explicit concurrent recovery and lost responses preserve the same receipt. Dry-run service wiring does not even construct provider adapters. Generic uncertain effects remain unrecoverable by this path.

Use inspection for lost responses. An idle admission can retry with its existing identity; a suspended admission can resume only after terminal gates; running/uncertain admissions require reconciliation. There is no UI reset, force retry, or workflow replacement for uncertainty. Schema compatibility does not imply automated repair of historical ambiguous records.

## Verification

For a self-contained local browser demonstration with an owned Mongo container, synthetic fixtures and persisted evidence, use [the local workflow demo](local-workflow-demo.md). Existing `npm run demo` and `npm run seed` are test stand-ins, not this browser acceptance runner.

See `docs/integration-30-verification.md` for executed checks and limitations. Reproducible local commands:

```sh
npm ci
npm run lint
npm run typecheck
npm test
MONGODB_TEST_URI=mongodb://127.0.0.1:27027/agency30_test_suite npx vitest run src/integration/client-pipeline-mongo.test.ts src/integration/engine-resume-mongo.test.ts
MONGODB_TEST_URI=mongodb://127.0.0.1:27027/agency30_test_restart AGENCY30_MONGO_CONTAINER=agency27-mongo node scripts/verify-integration-engine.mjs
npm run build
```

The restart command deliberately SIGKILLs a synthetic workflow worker and restarts the explicitly selected, matching loopback Mongo container. Use only an isolated test database/container. Ordinary tests skip opt-in Mongo/restart suites. No external send or payment is enabled or verified.

Protected Preview, real GitHub OAuth and production validation are not established by local checks. The known cross-host OAuth configuration issue and prior manual-deployment denial remain. No workaround deployment, empty commit, security-setting change or production operation is authorized by this source integration.
