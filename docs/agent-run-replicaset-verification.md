# Bounded agent-run replica-set verification

Verified 2026-11-14 against provider base `9ba0a3700cf4e9e51e11c6116a63aeb9b7e24e09` plus the local Task-index correction and tests described here. This supersedes the *local replica-set availability* limitation in the November 7–8 verification notes, not their protected Preview or live-provider limits.

## Defect found and minimal correction

The first real Mongo run failed before executing any of the nine original cases. `Task` declared each tracker index twice: a path-level ordinary index followed by an explicit sparse index with the same generated name. MongoDB rejected initialization with `IndexOptionsConflict`.

The correction removes only the two redundant sparse declarations. It retains the ordinary `mondayItemId_1` and `linearIssueId_1` indexes that initialization creates first, so an existing ordinary index does not need to be dropped or migrated. No `syncIndexes`, data migration, deployed-database change, or runtime capability change is included. A manually customized sparse-only index would need separate operator review; this change does not silently reconcile database indexes.

Two offline schema regressions failed before the correction and passed afterward. The real suite also passed against the same disposable database whose initialization had failed, proving compatibility with those already-created ordinary indexes.

## Real database results

- Official MongoDB **7.0.45**, verified against the vendor SHA-256 checksum; native temporary installation, no system settings changed.
- One-member replica set bound only to `127.0.0.1:27038`, using disposable storage and `agencyos_agent_run_test`.
- All nine original repository cases passed: persistence/replay, competing admission, immutable identity, Task/artifact/audit rollback, uncertainty, live Task-scope edits, tracker binding, and GitHub-bound Project rejection.
- One additional real-DB test passed: the completion transaction commits, its caller loses the response, and the service reconciles the authoritative completed record without repeating either generator or creating duplicate outputs/audits.
- Two offline Task-index regressions passed in the same focused run. Total: **12 passed, zero skipped**.

## Aggregate checks

`npm run build` passed with ordinary lint, typecheck, **393 tests passed / 58 opt-in tests skipped**, and production compilation/page generation. No font mocks were used. The 58 skips are not claimed as passes; the real-DB and crash checks above/below were run separately. Existing Mastra dynamic-import and Auth.js/Jose Edge compression warnings remain. `git diff --check` and the driver syntax check passed.

## Actual process death and database restart

The new opt-in harness injects only fictional generators. Three separate Node workers were killed with **SIGKILL** immediately after durable `claimed`, `task_created`, and `completed` boundaries. The final kill occurs after the completion commit but before its response returns.

After all three workers died, the disposable Mongo process was stopped cleanly and relaunched with the same data directory. Its writable-primary state was rechecked. A fresh Node worker then verified:

- Exact persisted run, Task, artifact, and correlated audit identities survive.
- Repeating the original request never invokes either generator.
- A replacement run ID cannot circumvent the Project claim.
- Completed Tasks remain done; an interrupted assigned Task remains in progress.
- Only the harness's random synthetic tenant fixtures are removed after successful verification.

This is **application-worker crash plus orderly Mongo restart evidence**, not an abrupt database/power-loss or multi-node failover test. The harness does not claim to inject a driver-level ambiguous transaction commit; it covers an application response lost after a real completed commit. It does not prove live model/API access, protected Preview authentication, or production readiness.

## Reproduce on a disposable loopback replica set

Use Node 22.13+ and an already-running compatible Mongo replica set. Do not point these commands at production/shared databases. The restart harness requires a credential-free `mongodb:` loopback URI, a database name containing `test`, and `directConnection=true`. No provider key is needed.

```sh
export MONGODB_TEST_URI='mongodb://127.0.0.1:27038/agencyos_agent_run_test?replicaSet=agencyos_test_rs&directConnection=true'
npx vitest run src/lib/agent-runs/mongoose-agent-run-repository.test.ts src/lib/tasks/task-model.test.ts

fixture="$(mktemp -d)/agent-run-restart.json"
node scripts/verify-agent-run-restart.mjs crash "$fixture"
# Stop and restart only your disposable Mongo process with its same data directory.
# Wait for its writable primary before continuing.
node scripts/verify-agent-run-restart.mjs recover "$fixture"
```

The crash command deliberately emits three failed Vitest worker runs. It succeeds only when each expected committed marker and unexpected worker exit are observed. Do not report those crashes as ordinary passing test cases. The recovery command must pass separately. The script does not itself restart Mongo, so script success alone is not evidence of a database restart. Preserve the fixture and database for investigation if recovery fails; do not reset a real run to retry.

All Mongo processes launched for this verification were stopped afterward. No deployed database, real credential, provider request, communication, payment, push, merge, or deployment was used.
