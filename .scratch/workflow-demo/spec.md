# Repeatable local workflow demonstration

Base integration f9548006b31b66cf1f1e93e442078a8a2e90a94e; no application/schema changes.

Gap: nine-check browser harness and bootstrap were executor-local, while npm demo/seed run stand-in tests. Add a repository-owned local-only runner and operator instructions. It creates a new loopback Mongo Docker container/database, temporary copy of app source excluding env files, an allowlisted child environment with ephemeral local auth, and Playwright browser. No user-supplied target URL, shared database, provider credentials or deployed settings. Export synthetic run/gate/receipt/audit and actual engine snapshot evidence; do not save cookies/tokens/traces. Keep data and browser available only with explicit interactive hold; always clean owned resources on exit. Pin browser test dependency and document install prerequisites/offline-font distinction.

Preserve immutable Client run, pending approval, explicit receipt recovery, unknown blocking, tenant/role isolation, fake effects, and truthful no-agent claims. Test safeguards first, run harness twice for repeatability, lint/typecheck/full tests/build as applicable, independent review. No push before parent review/authorization. No deployment/security changes.

## Verification before local review commit (2026-11-06)

- npm ci: passed, 797 packages; dependency addition limited to pinned Playwright and its dependency entries.
- lint/typecheck: passed.
- ordinary tests: 314 passed, 47 opt-in skipped.
- real Mongo integration: 38 passed / one child-process-only parent skip; historical compatibility: seven passed. Separate actual process-death/Mongo-restart/fresh-process Mastra resume passed.
- nine browser checks and persisted evidence passed on fresh owned databases. Initial draft assumed a public directory existed; corrected. Earlier storage-removal assertion restored storage before the retry settled; corrected to await final failure and idle UI, then reran. Only corrected runs are acceptance evidence.
- ordinary build with cached artifacts passed, but clearing generated build cache reproduced Google Geist/Geist Mono download failure. Font-mocked full build passed; ordinary clean build remains blocked.
- Independent reviewer: six safeguard tests and diff check passed. Fixed remote Docker context selection, canonical named-pipe support, cleanup truthfulness/ownership, and Node prerequisite. No substantive finding remained.
- No application/schema/security changes. Hosted Preview/GitHub OAuth, production, headed/hold mode and cross-platform browser execution were not run. Exact clean-commit browser evidence is produced after this local commit and retained outside tracked files.

## Parent review corrections (2026-11-06)

Parent review found generated next-env.d.ts was incorrectly required, Playwright's default did not enforce the documented sandbox, and shutdown failures could be hidden. Removed all generated declarations from copy inputs; Next generates them. Explicit chromiumSandbox is true unless --no-sandbox. Bounded shutdown records all failures; SIGTERM/SIGKILL verifies both the spawned Next CLI exit and absence of live descendants in its owned POSIX process group. Windows execution is now explicitly unsupported. Failed cleanup retains the temporary workspace and exits nonzero after evidence is written.

Regression coverage includes missing generated files/no dotenv copy, launch options, rejected/hanging browser close, failed process exit, and actual parent+server processes ignoring SIGTERM then killed and verified as a group. Optional screenshots retain only synthetic Client/pending/receipt/completed views. Fresh tracked-checkout installation and both sandbox modes are verified separately in the final correction report; prior ordinary Google Fonts limitation remains.
