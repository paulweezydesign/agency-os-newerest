# Bounded agent-run implementation and verification

Date: 2026-11-07. Branch: `integrate/v1-review-candidate`.

## What is implemented

- An operator-only `POST`/`GET /api/projects/[projectId]/agent-runs` boundary, separate from general agent chat.
- A fixed fictional `synthetic-brief-v1` fixture. POST accepts exactly `runId` (UUID) and `fixtureId`; GET accepts the run ID query parameter. Tenant, actor and configured Project are server-owned.
- A Project Manager with only the bound `createTask` tool, forced tool choice and one model step. A tool-free Tech Lead returns a validated brief. Missing Task-tool execution cannot count as success.
- Explicit single-model injection, no provider/SDK/processor retries, 1,500/3,000 output-token ceilings and a 30-second deadline per model invocation.
- A new AgentRun model with unique tenant/run and tenant/Project indexes. Mongo transactions bind admission/audit, Task/checkpoint/audit, and artifact/Task completion/checkpoint/audit. No existing data migration.
- Idempotent inspection after response loss, immutable Task scope, and blocked uncertainty rather than automatic execution replay.
- Completion verifies the Task's original title/description, assignee, status, tenant/Project and absence of tracker links. A human scope edit during generation must not be marked done by the old brief.

The path imports no broad agent, tracker, GitHub, Slack, research, email, payment or policy-gate service getters.

## Provider wiring update (2026-11-08)

The follow-up OpenAI adapter now wires `getAgentRunService()` to the specifically requested `gpt-6-astra` through Mastra's Responses API transport. It remains default-off and requires server-only credentials plus the existing explicit synthetic scope. See [the current setup and verification guide](openai-bounded-provider.md). No real key or paid model request was used during implementation. The original live-wiring status below describes the candidate before that follow-up.

## Original live-wiring status (before the OpenAI follow-up)

`getAgentRunService()` intentionally returns an unavailable error. **Setting environment variables does not enable a working live provider.** Authorized requests still receive HTTP 503 until a reviewed adapter is wired. No credential lookup, OAuth flow, ChatGPT sign-in, NVIDIA endpoint or OpenAI fallback was added.

The factories and injected service are implemented; they have not made a real model call. The offline Mastra test checks actual configured capability/limit options but mocks the Agent runtime. It is not evidence that an external provider supports forced tool choice or structured output.

The new feature has no dashboard run-control UI yet. Existing Task/artifact views can inspect outputs once a supported runtime is wired and verified. UI start/inspect controls and live acceptance remain follow-up work, not completed functionality.

## Configuration contract

- `AGENCYOS_AGENT_RUN_ENABLED=true` explicitly enables the boundary.
- `AGENCYOS_AGENT_RUN_TENANT_ID` and `AGENCYOS_AGENT_RUN_PROJECT_ID` bind one confirmed synthetic scope.
- `AGENCYOS_AGENT_RUN_MODEL` names the explicitly approved model. It has no default.
- Local execution requires `NODE_ENV=development` without hosted Vercel markers.
- Preview additionally requires `VERCEL_ENV=preview` and `AGENCYOS_AGENT_RUN_PROTECTED_PREVIEW=true`. The latter is an operator assertion; verify real deployment protection separately before setting it.
- Production is rejected. Mongo must support replica-set transactions. The intended synthetic Project must exist and must not have a GitHub repository binding.

The selected API model and OpenAI destination are now explicit; account-specific access, billing and live acceptance remain unverified. Do not assume a subscription alone proves API entitlement or credits. The user supplies their own server key. No automatic fallback is configured.

## Executed checks

Fresh installation used `npm ci --cache /tmp/agencyos-v1-npm-cache --no-audit --no-fund` without changing dependency manifests.

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 76 test files passed; 365 tests passed. Five opt-in files / 56 tests skipped, including nine new replica-set cases. Skips are not passes.
- `npm run build`: passed for the final combined candidate, including lint, typecheck, all 365 ordinary tests and production compilation/page generation. No font mocks were used. The known Mastra dynamic-import warning remains; the earlier clean consolidation build also reported the existing Auth.js/Jose Edge compression warning.
- `git diff --check`: passed.
- Independent final source review found no remaining P0/P1/P2 issue. Its 43 focused tests passed; nine Mongo tests skipped. The Task-scope race found in the first review was corrected.

## Real database and browser limits

The executor has no Docker daemon. An ephemeral official Mongo runtime was attempted outside the repository without modifying application dependencies. Mongo 8.2.6 aborted during CPU discovery; Mongo 7.0.45 exited during startup with `open: Operation not permitted`, including an approved escalated execution attempt. No deployed database was used. Therefore transaction rollback, real unique-index contention, process crash/restart and the live-edit regression are **not verified against a running replica set** here.

The opt-in suite is `src/lib/agent-runs/mongoose-agent-run-repository.test.ts`. It requires `MONGODB_TEST_URI` pointing to a loopback replica set and a database name containing `test`. It uses a random tenant and removes only that tenant's synthetic fixtures. Never supply a production/shared database URI. Run this suite in a compatible isolated environment before live-model acceptance. Separate fresh-process/crash acceptance remains outstanding beyond these repository tests.

The supported browser could not reach the local sandbox app. New combined browser QA, mobile/focus/contrast verification and authenticated operator navigation are not established by this turn. Prior separate-theme and workflow demonstrations are historical evidence, not substitutes for the combined candidate.

## Safe failure interpretation

Model timeout closes the Task callback and prevents late outputs from starting new persistence. A database write already in progress is not forcibly canceled. Transaction conflicts/uncertain commits must be inspected. Failure to persist the uncertainty audit can leave the earlier `claimed` or `task_created` state; it still cannot be automatically replayed. Do not reset or delete the record to retry.

No real model, external delivery, payment, tracker synchronization, source push, PR change, merge, deployment or production setting change was performed for this implementation.

## Reconstructed candidate verification — 2026-11-08

The previous unpublished checkout disappeared after an executor restart; its local commit `d35fb5f` is not available remotely. The candidate was restored from the exact pinned integration/theme sources and the original retained creation commands and subsequent edits. All 17 new source/test files retain the prior 778-line scope, with no intentional functional change. Original Git blobs are unavailable for a byte-level comparison, so this is a newly identified commit, not a claim that the old SHA was recovered.

Fresh `npm ci`, lint, typecheck, all 365 ordinary tests and the ordinary production build passed again without font mocks. All 56 opt-in tests remain skipped. Independent source re-review found no substantive issue; 43 focused tests passed and nine replica-set tests skipped. Prior runtime/browser limitations above remain outstanding. The user authorized normal source publication and a draft review PR, including the existing automatic Preview hooks; this does not authorize merge or Production promotion. Provider wiring remains a separate follow-up.
