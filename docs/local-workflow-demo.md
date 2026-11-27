# Repeatable local workflow demo

This demonstrates the existing deterministic synthetic lead workflow: saved Client → score/route → human gate → approval or denial → actual Mastra resume → persisted receipt and audit. It does not invoke an LLM or prove the broader brief/SOW/scaffold V1.

## Setup

Use Linux or macOS (POSIX process groups are required; Windows execution is unsupported). Use a local development shell with Node 22.13+ (required by the installed Mastra core), npm, a running local Docker daemon, and Chromium. The runner rejects production, CI and common hosted environment markers. It accepts only a local Docker socket/named pipe, never a supplied database or app URL.

From the repository:

```sh
npm ci
docker pull mongo:7
npx playwright install chromium
npm run demo:workflow
```

On Linux, Playwright may report missing system browser dependencies; install those using your machine's normal administration process. Alternatively select an already installed Chromium:

```sh
npm run demo:workflow -- --chromium=/usr/bin/chromium
```

Only in an isolated container whose browser sandbox cannot start, explicitly add `--no-sandbox`. The runner explicitly sets Playwright chromiumSandbox=true by default and false only for that option. A host that cannot run sandboxed Chromium will fail rather than silently downgrade. Docker image/browser downloads are setup steps; the runner does not pull an image automatically.

For a visible browser that stays available after acceptance:

```sh
npm run demo:workflow -- --headed --hold
```

A graphical display and interactive terminal are required for that mode. The runner prints the loopback URL after verification. Ctrl+C closes its browser/app, removes its owned Mongo container and temporary app copy, and preserves evidence. Each invocation gets a new container, random database, app port and ephemeral auth secret. No pre-existing database is used or cleaned. SIGKILL or machine failure cannot execute cleanup; if that happens inspect the uniquely named `agency-demo-<id>` container from your run before manually removing only that container.

## What runs

The runner copies an explicit allowlist of source/config files to a temporary app directory; repository `.env*` files are excluded. Generated next-env.d.ts and .next are not copied; Next creates its own declarations, so no prior dev/build is needed. The child environment is allowlisted and uses existing local demo auth, the dry-run flag and isolated Mongo. The app and Mongo bind to 127.0.0.1. It uses existing `tenant-default` local operator credentials from the repository, never GitHub or deployed credentials.

Three fictional Clients with `.test` contacts cover nine browser checks:

1. Sign in through the existing local-demo login.
2. Double-click start: one request, pending gate, resume disabled.
3. Reload: identical saved UUID, inspect without new start.
4. Approve, inspect and resume the actual suspended engine.
5. Reject another UUID on the completed Client.
6. Deny a separate Client's gate and resume without a receipt/effect.
7. Lose a committed start response; retry/reload the same UUID.
8. Inject an approved/failed state into only this runner's synthetic gate; verify resume blocked, explicitly recover its dry-run receipt, then resume.
9. Remove retained browser storage; wait for the failed retry to settle and verify no replacement request.

The deliberate failed-state injection is a test fixture, not a production recovery instruction. A fresh Client is required for every new workflow; there is no same-Client reset. After acceptance the held browser shows the completed approved Client. To rehearse another decision, create a new Client with a `.test` contact via the dashboard and use its pipeline form.

## Evidence and limits

Each run writes `.scratch/demo-evidence/<id>/evidence.json`, `completed-workflow.png`, three intermediate synthetic-flow screenshots, and `server.log` (gitignored). The JSON includes the source commit/dirty marker, Mongo/browser versions, nine checks, request identities, and selected persisted Client/run/gate/receipt/audit fields plus the real Mongo-backed Mastra snapshot status. It asserts exactly one run and gate per fixture, expected scores/routes, successful engine snapshots, matching approval receipts, no denial receipt/effect, and required audit stages. Browser requests outside the local app are blocked and fail acceptance; browser JavaScript errors fail acceptance. Cookies, auth secrets and browser traces are not exported.

Fonts use a documented local mock to avoid Google Fonts network dependence. This is local browser verification, not an ordinary production-build result. The browser fixture covers the UI and persistence within one app process; separate-process/Mongo restart coverage remains in `scripts/verify-integration-engine.mjs` and the integration tests described in [the workflow runbook](issue-27-synthetic-workflow.md).

Exit 0 requires acceptance and cleanup success. Browser/storage shutdowns are bounded and errors recorded; the owned app process group is verified stopped after SIGTERM and, if needed, SIGKILL, including the Next server descendant. Defunct process entries are not live application processes. Unverified shutdown retains the temporary workspace, records cleanupErrors, and exits unsuccessfully instead of hanging or claiming cleanup. Inspect `passed`, any failure/cleanupError and the command exit status together. Earlier failed attempts remain separate evidence directories. The runner's held mode is for local rehearsal only. Protected Preview/GitHub OAuth acceptance, production, live effects, and agent execution are not established by this demo. Existing Preview configuration/deployment blockers remain external to this code.
