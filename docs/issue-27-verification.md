# Issue 27: local dry-run acceptance and protected Preview handoff

This branch adds a durable approval claim and a bounded registered Mastra workflow. It invokes domain services, not teammate agents. `agentRole` remains descriptive metadata. No actual email delivery or payment is implemented by the beta workflow.

## Design and compatibility

See [the pre-implementation schema design](../.scratch/issue-27/spec.md). The additive gate fields are `executionState`, `claimToken`, `claimedAt`, `requestKey`, `requestFingerprint`, and `workflowRunId`. Existing decision statuses remain unchanged. The claim transition uses tenant/id/pending/no-execution-state predicates and journaled majority writes. Completion requires the winning claim token. Denial cannot replace a claim. Failures never release a claim, and there is no lease expiry or automatic effect replay.

Gate request keys use deterministic, tenant-scoped ObjectIds plus an immutable request fingerprint. Mongo's existing `_id` uniqueness prevents concurrent duplicate creation without a new index migration. Legacy requests without keys retain their create behavior. The pipeline supplies a stable request key from client and correlation ID. The beta endpoint binds a caller-generated UUID to a tenant/client-scoped run ID and rejects different input under that same ID.

`client_pipeline_runs` contains admission state, input fingerprint, tenant/client/correlation IDs, timestamps, and start/resume phase. The official `@mastra/mongodb` adapter stores actual workflow snapshots. The tested versions are core 1.57.0 and Mongo adapter 1.16.0 (compatible peer range); no core upgrade was needed. See official [Mongo storage](https://mastra.ai/integrations/databases/mongodb) and [suspend/resume](https://mastra.ai/docs/workflows/suspend-and-resume) documentation. No migration or staging write was performed.

The workflow is registered as `clientPipeline` with ID `client-pipeline`. `route-lead` records domain-service execution and zero agent invocations; `human-approval` suspends while a gate remains pending. Resume reads the tenant-scoped durable gate and cannot accept a browser approval boolean. Mongo snapshot availability is checked before admitting another resume. A process death with an unfinished admission remains blocked even if a snapshot exists; snapshots are evidence, not a license to rerun effects.

The beta endpoint requires an authenticated admin or agent-operator, `AGENCYOS_BETA_WORKFLOW=dry-run`, and Mongo. It refuses Vercel production. Contacts must be reserved `.test` addresses; no email means no gate. Production policy-gate wiring routes every workflow gate directly to the no-provider fake runner, and skips Slack notification. Provider factories are lazy and never reached for workflow gates, including when credentials exist.

## Repeatable local verification

```sh
npm ci --cache /tmp/agency-npm-cache
npm run lint
npm run typecheck
npm test
npm run build

docker run -d --name agency27-mongo -p 127.0.0.1:27027:27017 mongo:7
node scripts/verify-beta-mongo.mjs
```

If the named local test container already exists, start it instead of creating another. The script uses a unique `agency27_test_*` database on loopback port 27027, prints its name, and retains only synthetic evidence. It rejects other database locations. The ordinary test suite intentionally skips Mongo integration when `AGENCYOS_TEST_MONGO_URI` is absent. The integration driver executes separate seed, claim-crash, effect-crash, workflow-gate-crash, and recovery Node processes. The three intentional SIGKILL worker failures are expected; the driver requires those failures and then verifies durable records and no duplicate effects in the recovery process. Other failures fail the driver.

Local Mongo is a standalone Docker server. These tests establish concurrency, journaled writes, real process-death behavior, and fresh-process recovery; they do not establish replica-set failover behavior or protected staging acceptance.

## Protected Preview smoke procedure — blocked until publication is authorized

Do not run this against production or an existing staging database without authorization. The unpublished branch cannot be verified through protected Preview under the current no-push/no-deploy boundary. CI and protected Preview remain unverified for this branch.

After separately authorized publication and Preview configuration:

1. Sign in through allowlisted GitHub auth as an admin or agent-operator. Create synthetic Clients named `Example Test Agency <score>` with `lead<score>@example.test` for scores 39, 40, 45, 69, and 70. Record Client IDs only, never cookies or tokens.
2. From the authenticated browser on that Preview, POST to `/api/clients/<clientId>/pipeline/workflow` with JSON `{ "operation": "start", "requestId": "<fresh UUID>", "leadScore": 70 }`. Retain the UUID for all retries. The response includes a stable run/correlation ID, admission state, and Mongo snapshot with gate IDs. For 39 expect success/disqualified/no gate; 40, 45, 69 expect suspended/nurture; 70 expects suspended/onboard. Inspect Mongo in the approved environment to confirm persisted contact, score and stage.
3. Retry the identical start body and verify the same run/gate IDs. Change the score with the same UUID and expect HTTP 409. Use `operation: inspect` with that UUID to view saved state.
4. Deny the score-45 gate through the policy queue; approve the score-70 gate. Approval records a fake effect only. Repeat decisions and expect 409; no extra effects. POST `{ "operation": "resume", "requestId": "<same UUID>" }` for each run and expect success with the saved denied/approved gate. Resume a still-pending run and expect suspension again.
5. After an authorized server restart, inspect those same UUIDs. Verify saved run, gate, contact, score and audit correlation. Test unauthenticated and client-role requests (401/403), another tenant's Client/run (404), malformed scores (400), and forged identity/approval fields (400).
6. Record branch SHA, Preview URL, synthetic IDs, run/correlation IDs, gate states, timestamps and observed responses. Do not claim teammate execution or email delivery. Capture explicit evidence that no outbound provider requests occurred.

## Failure review and rollback

A `claimed` gate may have crashed before or after its fake effect; `uncertain` explicitly records an unconfirmed outcome. Neither is eligible for approve/deny retry. Review the gate, claim token, timestamps, admission record, Mastra snapshot and correlation logs. `effectRan=false` on an unfinished claim does not prove no effect occurred. Do not delete/reset a claim or start a replacement run to resolve uncertainty.

This change intentionally adds no automatic reconciliation/reset endpoint. Human review must establish the outcome before a separately authorized repair. If completion committed but the response was lost, the approved record remains terminal. If only snapshot/admission persistence failed, preserve both records for review; do not infer safe execution from snapshot absence. An audit failure after a completed effect also leaves the durable approval terminal.

Legacy approved/denied rows remain terminal and legacy pending rows without a claim can be processed. Rolling back to the old writer is unsafe while claims exist because it ignores the new fields. Disable decision handling and reconcile outstanding claims before any rollback. Existing legacy-provider behavior is retained outside the explicitly bounded beta flow.

## Executed results — 2026-11-03

- `npm ci --cache /tmp/agency-npm-cache`: passed. The first attempt with npm's default cache failed because `/home/agent/.npm` was not writable; the explicit temporary cache resolved it.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed.
- `npm test`: 71 files / 249 tests passed; the three opt-in Mongo phase tests are skipped in the ordinary suite.
- `node scripts/verify-beta-mongo.mjs`: passed. Separate seed/recovery processes plus three deliberately SIGKILLed workers proved durable claims before/after the fake effect and zero duplicate effects on re-entry. The third process died immediately after workflow gate creation and request-audit persistence, before the route step returned; recovery preserved exactly one gate and refused to rerun the unfinished admission. Final evidence database: `agency27_test_6b4b72cd63c345fea63b73ea8e3a05e1` on local port 27027. All three crash phases intentionally cause Vitest's “Worker exited unexpectedly”; the driver checks this and verifies the resulting records in its final recovery phase.
- Ordinary `npm run build`: lint/typecheck/tests passed; Next compilation failed fetching existing Geist/Geist Mono fonts. Direct curl confirmed the network proxy returns HTTP 403 for `fonts.googleapis.com`.
- Supplementary `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/agency27-font-mocks.cjs npm run build`: passed, including Next compilation and page generation. Temporary responses substitute local system-font CSS only. This is an offline compilation check, not proof that an ordinary build or real font rendering passes. No app font code, provider config, or CI config was changed. Do not deploy the supplementary build output.
- Next reported existing Auth.js/jose Edge Runtime warnings. Mastra's default unconfigured registry emits an in-memory fallback warning during build; the new workflow explicitly refuses that fallback, as covered by regression, and the beta runtime uses real MongoDBStore.
- `git diff --check`: passed.

No push, PR creation/approval, merge, deployment, staging mutation, or live effect occurred. CI, protected Preview smoke, and replica-set failover remain unverified. The normal build's font-network failure remains an environment blocker. The code is prepared for local review; do not describe issue #27's protected-staging acceptance gate as complete.

## Final independent review

A fresh reviewer inspected commit `11b6b0de2a391e45f86f5b0bc78995b850a22bb7` and found no blocking duplicate-effect, tenant-isolation, Mongo-persistence, or live-provider defect. One minor API correctness issue was found: denial's pending-state compare-and-set could lose to an approval claim and report HTTP 404 for an existing gate. A regression reproduced that response; the follow-up changes it to HTTP 409. The initial tenant-scoped not-found response remains 404.

The reviewer also qualified the earlier gate-creation crash evidence: it replayed a completed domain step rather than killing that exact process window. The new `crash-workflow` phase closes that evidence gap with an actual SIGKILL. The reviewer inspected this follow-up, found no new issues, and independently ran six focused files / 25 tests successfully, including the new HTTP 409 regression. Full verification was rerun: installation, lint, typecheck, and 249 tests passed; the real Mongo driver passed all five phases. The ordinary build still fails on the environment's blocked Google Fonts requests; supplementary font-mocked compilation is reported separately above.

Exact runtime versions: Node 24.19.0; npm 11.9.0; MongoDB 7.0.45; Mongoose 9.9.2; Mastra core 1.57.0; Mastra MongoDB adapter 1.16.0; Vitest 4.1.10; Next 15.5.23. Docker image `mongo:7` resolved to image ID `sha256:bf46c3fd4f186a3569a6c8d180ee6f55e46cc81e98c0cadaee2f56718c84979f`.

Independent focused command:

```sh
npm test -- --run src/lib/policy-gates/approval-safety.test.ts src/lib/policy-gates/policy-gates-api.test.ts src/lib/policy-gates/get-policy-gate-service.test.ts src/lib/policy-gates/request-replay.test.ts src/lib/client-pipeline/beta-workflow-api.test.ts src/mastra/index.test.ts
```

The local database inspection confirms actual `mastra_workflow_snapshot` documents for `client-pipeline`: run-39, run-45, run-70, and missing-email are successful; run-40 and run-69 remain suspended; crashed-workflow remains running and blocked for review. The separate admission collection agrees. There are 13 policy gates and four recorded synthetic fake effects. The crash-before-effect and crash-after-effect gates both remain claimed; their `effectRan=false` values do not license a retry.
