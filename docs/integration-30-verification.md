# PR30 / durable Mastra / operator UI verification

Date: 2026-11-04. Local branch `integrate/30-durable-mastra-operator-ui`.
Foundation fetched and independently checked with git ls-remote: `16d4228d3f216218e1473177d44f1e42e4235e71` (draft PR #30). UI source likewise verified: `cb367cd54ec938c09a3a1c79ee32579a24159e9e`. Initial worktree was clean. This is a separate branch based on the foundation, not a wholesale merge; neither source branch nor theme PR #25 was modified.

## Implemented and reviewed

- Retained foundation competing decision CAS, atomic dry-run receipt, explicit recovery, generic ambiguity blocking, tenant/request-key gate identity, unique tenant/Client run and Client reservation including in-flight legacy writes.
- Added MongoDBStore-backed actual Mastra suspend/resume around those domain services; no separate raw admission collection. Admission CAS prevents duplicate start/resume, and verified persisted snapshots precede successful admission completion. Majority/journal writes are requested for admission and engine storage.
- Terminal gate and engine success are distinct. Approved/running, failed, unknown, missing receipt, or legacy executionState cannot authorize resume. Orphaned gates remain inspectable without restarting their engine.
- Old checkpoint-only records are not silently promoted to engine snapshots. Old claimed/uncertain gates cannot be approved, denied or recovered by the new writer.
- Provider factories are lazy; an already persisted foundation-shaped dryRun gate never touches them.
- Operator form preserves tenant/Client identity across retry/reload and browser response loss, verifies response identity, supports inspect/resume and explicit gate recovery. New score scenario requires a new Client; no reset or same-Client replacement is provided.

Independent reviewer found an idle-admission UI retry gap; fixed and regression covered. Final independent source review found no remaining substantive issue. Reviewer independently ran seven files / 82 tests (controller, API, rendering, policy service/API, provider boundary and Mastra registration). Reviewer did not claim independent browser, Mongo restart or build execution.

## Executed checks

- `npm ci --cache /tmp/agency30-npm-cache`: PASS (795 packages). First dependency-install attempt failed because the default npm cache path was unavailable; using a writable temporary cache resolved it. No dependency version changed except addition of Mongo store and its dependencies.
- Foundation baseline, before implementation: four files / 61 tests passed, one restart-only test skipped; used real local Mongo.
- Regression-first tests observed expected failures for missing engine persistence, eager provider construction and historical claimed/uncertain gates before fixes.
- Final `npm run lint`: PASS.
- Final `npm run typecheck`: PASS.
- Final ordinary `npm test`: 70 files passed / three opt-in files skipped; 307 tests passed / 40 skipped. These skipped tests are not counted as ordinary-suite passes.
- `MONGODB_TEST_URI=mongodb://127.0.0.1:27027/agency30_test_suite npx vitest run src/integration/client-pipeline-mongo.test.ts src/integration/engine-resume-mongo.test.ts`: 38 tests passed, one separate-process-only test skipped in the parent invocation. The suite also launches that fresh-process resume case successfully. Covers competing approval/denial, concurrent runs and resumes, both legacy/reservation race directions, changed payload, new UUID after completion, two UUIDs racing, audit append failure, lost claim/receipt/admission responses, generic effect success followed by persistence failure, historical gate IDs/receipts, historical claims, snapshot write failure, snapshot/admission inconsistency and orphaned gate checkpoint failure.
- `MONGODB_TEST_URI=mongodb://127.0.0.1:27027/agency30_test_restart AGENCY30_MONGO_CONTAINER=agency27-mongo node scripts/verify-integration-engine.mjs`: PASS. Separate seed process persisted a suspended engine; crash phase killed a real Node worker with SIGKILL after gate creation and before result checkpoint. The harness expects Vitest's worker-exit error only for this phase. It restarted the matching loopback Mongo process and ran fresh-process recovery. Persisted snapshot changed suspended->success via resume; original routing audit IDs and receipt stayed identical. Killed invocation stayed blocked with one retained gate. Initial harness attempts exposed Vitest's interception of process.exit and worker signal reporting; corrected harness uses SIGKILL plus persisted crash marker and expected worker-exit evidence.
- Mongo server: `mongo:7`, mongod 7.0.45, loopback port27027. Node24.19.0; Mastra core1.57.0 / Mongo store1.16.0. No deployed database accessed.
- Ordinary `npm run build`: FAILED at Google Fonts fetching Geist/Geist Mono. A new test-helper type error found during the first build attempt was fixed; the subsequent ordinary build reached the font-network failure.
- `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/agency27-font-mocks.cjs npm run build`: PASS, including lint/typecheck/full ordinary suite and Next production compilation/page generation. Temporary font responses substitute local Arial/Courier; this is not proof of ordinary font download. Mastra dynamic-dependency warning remains.
- `git diff --check`: PASS.

## Local browser proof

Chromium154.0.8037.57 via Playwright against http://127.0.0.1:3100, isolated `agency30_test_browser_f068077c31c2` database. Existing development-demo auth only, fresh ephemeral local AUTH_SECRET; no deployed credentials. Browser routing blocked non-loopback requests.

Nine checks passed: demo operator login; double click produces one start/pending gate; reload retains UUID without new start; approval receipt then actual engine resume; new UUID on completed Client rejected409; separate synthetic Client denial/resume; server-committed start with lost browser response retries identical UUID/payload; approved/failed effect blocks resume until explicit dry-run recovery; clearing browser storage while mounted cannot create replacement. No page JavaScript errors or nonlocal browser requests recorded. Local server stopped after verification.

Browser harness/evidence/logs are retained under `/tmp/agency30-browser` and copied into the executor handoff artifacts. Controller/source tests are additional coverage, not substitutes for these browser checks.

## Remaining limits and publication boundary

- Protected Preview, real GitHub OAuth, and production verification were NOT RUN. The known cross-host OAuth callback mismatch, unapplied Preview dry-run environment flag on the earlier deployment, and prior manual redeploy denial remain. No OAuth app, credential, security setting, deployment protection or provider/CI configuration changed.
- No push, PR creation/approval, merge or manual deployment was performed during this integration. Intended source publication is the integration branch at existing origin `https://github.com/paulweezydesign/agency-os-newerest.git`, after reporting exact local HEAD and verification. A genuine source push may automatically trigger existing GitHub/Vercel integrations, potentially both Vercel projects previously observed; it is not evidence Preview has been validated or that branch-specific environment settings apply to this new branch.
- GitHub CI billing remains a reported external blocker; no CI result is claimed green. Theme integration and live sends/payments were not tested or enabled.
- Admission and engine snapshot writes are not one transaction. Unknown windows intentionally require reconciliation; there is no lease-based automatic replay. Existing historical engine/admission formats are not automatically migrated.

## Post-push historical-format correction

Independent post-push review identified a missing historical case at published `027114024136c33bd346cfa2a4dd9ecae07cecfa`: undecided operator-era gates could carry `payload.executionMode: "dry-run"` and/or `workflowRunId`, with neither `dryRun` nor `executionState`. The new reader omitted workflowRunId and the decision service treated these as generic gates. A real-Mongo regression reproduced provider-factory entry for all three marker combinations. Throwing mock factories prevented any effects; current provider factories are in-memory, so this was not evidence of live delivery.

Correction preserves historical workflowRunId when reading, identifies unsupported historical markers before decisions/effects/notifications, and adds a Mongo decision-CAS backstop. Undecided synthetic records remain pending and receive a format-review409; claimed/uncertain/unknown records receive reconciliation409. Neither is silently migrated or converted into a foundation receipt. Explicit foundation dryRun:true records still follow the existing atomic receipt path. Request API also rejects historical-format payloads deliberately rather than returning an unhandled500. The operator queue displays the reason and hides inappropriate actions.

Regression includes actual persisted payload-only, workflow-ID-only and combined shapes; approve/deny/recover409; direct CAS rejection; unchanged pending status/no receipt; ambiguous shapes; and explicit foundation receipt/recovery with historical metadata. Independent reviewer ran four files/30 tests against local Mongo, found the request-API mapping gap, then verified its fix with 12 API tests. No substantive finding remained.

Corrective verification: local Mongo45 passed (one separate-process-only skip in parent invocation); final ordinary suite308 passed/47 opt-in skipped; lint/typecheck passed; font-mocked production build passed. Ordinary font-network failure remains the previously recorded limitation; browser and SIGKILL/restart checks were not repeated for this narrowly scoped correction. No credential/settings changes, manual deployments, or external effects. The corrective commit is authorized for normal push only to the existing integration branch; automatic deployments must be tracked for its own SHA rather than inheriting prior-head success.
