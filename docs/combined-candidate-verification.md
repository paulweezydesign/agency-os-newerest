# Combined candidate verification

Verified locally on 2026-11-14. Integration branch: `fix/agencyos-verified-integration`. Tested application code: `3401ceb9e9f80883f65eed02d6f598775a4c1dc8`, based on provider commit `9ba0a3700cf4e9e51e11c6116a63aeb9b7e24e09`.

## Included changes

The following reviewed changes were cherry-picked without conflicts into a separate worktree. The source branches were left intact.

- `44dd833c` became `5dad997`: remove duplicate Task tracker index declarations while preserving ordinary indexes; add real-Mongo lost-response and process-death verification.
- `7f2b63ab` became `60225ba`: authorize session routes before constructing storage or agent dependencies, preserving existing handler authorization and response contracts.
- `fb532d7c` became `3401ceb`: bind change-request and design-review decisions to the authorized URL Project before any mutation. Cross-client IDs in the same tenant return not found without changing the target, creating audits, or applying budget changes.

No dependency, provider, credential, deployment, or database configuration was changed by integration. Dependencies already installed for the same provider base were reused.

## Combined verification

- `npm run build` passed: ESLint, TypeScript, **587 ordinary tests passed / 58 opt-in tests skipped**, and normal Next.js production compilation/page generation. No font mocks were used for this build. Skips are not reported as passing tests.
- On a new disposable loopback MongoDB 7.0.45 single-member replica set, the repository and Task-schema suites passed **12 tests with zero skips**, including transactional rollback, competing admission, scope/tracker guards, immutable identities, and completion-response loss without duplicate generators or outputs.
- The committed restart driver observed three intentional worker SIGKILLs after durable `claimed`, `task_created`, and `completed` checkpoints. The owned Mongo process was then stopped cleanly and relaunched with the same data directory. A fresh recovery process passed, preserving exact Task, artifact, run, and audit identities and invoking no generator on replay.
- An independent reviewer inspected the combined code, found no blocking regressions, and independently passed **238 focused tests across eight files**. `git diff --check` passed.
- The existing local HTTP authorization harness passed **15 checks** against the combined code with absent loopback Mongo, an ephemeral development auth secret, a synthetic client login, and no provider credentials. Warm anonymous `/api/clients` returned 401 in 19 ms; the authenticated client request returned 403 in 30 ms. This temporary development server used the existing font mock, so it is authorization evidence rather than font or browser acceptance. The owned server was stopped afterward.

The Mongo replica set listened only on `127.0.0.1:27039`, used a new `agencyos_combined_test` database, and was stopped after verification. Tests used fictional generators and synthetic fixtures. No deployed database or real provider key was used.

## Reproduction and remaining gates

Use `npm run build` for the aggregate check. The isolated replica-set setup and separate crash/recovery commands are documented in [agent-run replica-set verification](agent-run-replicaset-verification.md). Restart the disposable Mongo process between the crash and recovery commands; the driver does not restart it itself.

Existing Mastra dynamic-dependency and Auth.js/Jose Edge compression warnings remain. This is local code, authorization, transaction, application-crash and orderly-database-restart evidence. It does not establish abrupt database/power-loss recovery, multi-node failover, protected Preview acceptance, live GitHub OAuth, live model access/output, or browser visual/keyboard/mobile behavior.

Webhook signature-before-storage behavior is a separate existing contract and remains outside these session-route changes. No push, PR update, merge, deployment, production change, live model request, communication, or payment was performed.

## Webhook safety integration update — 2026-11-14

The next isolated branch is `fix/agencyos-webhook-integrated`. Application code `16a3699578fa4a6620bc28a3b6e37f6442e23a97` cleanly cherry-picks reviewed webhook commit `e290b427785dd113ac595bc2775d64d884da01ba` onto the earlier final candidate `9e9cfec5a80aa1e803840180e897c5f7b2500649`. `git range-diff` confirms the cherry-picked patch is unchanged; the earlier branches remain intact.

This supersedes the webhook follow-up above: the Linear, Monday, and Stripe adapters are synthetic fixtures, so all three routes now fail closed with 503 outside local development/test and in every Vercel environment, before parsing or initializing dependencies. Local fixtures retain lazy validation-before-storage. They remain unauthenticated and require loopback binding plus isolated fictional data. This is not a live provider integration. See [webhook safety boundaries](webhook-safety.md).

Fresh checks against this exact application code:

- `NEXT_TELEMETRY_DISABLED=1 npm run build` passed ESLint, TypeScript, **634 ordinary tests / 58 opt-in skips**, and production compilation/page generation. No font mock was set. The webhook worker's earlier Google Fonts DNS failure did not recur; a separate font-mocked build was unnecessary. The first build attempt had stopped at Next's telemetry configuration write on the read-only home filesystem; disabling telemetry for the command resolved that environment issue without source changes.
- The committed HTTP harness passed **nine checks** against the newly built application: six production requests returned the expected 503, and three development invalid-payload/signature requests returned the existing 400 errors. No Mongo URI or provider credential was supplied. Both owned loopback servers stopped. Updated evidence is in `.scratch/webhook-safety/http-evidence.json`. The harness uses the existing font fixture for its development server; this is route behavior evidence, not visual browser QA.
- Independent combined review found no blocking regression and passed **283 focused tests across nine files**. `git diff --check` passed.

The earlier replica-set/crash evidence above belongs to the unchanged database slice. No fresh Mongo run is claimed for this update: its temporary native binary and orchestration files were no longer present, and no replacement runtime or database was created. Agent-run, Task, and restart-harness source is unchanged from `9e9cfec`.

Existing build warnings and protected Preview, live OAuth/provider, multi-node failure, and visual/keyboard/mobile acceptance limits remain. The local Stripe fixture parser and payment replay handling are not production verification. No push, deployment, provider settings, credential changes, or external effects occurred.
