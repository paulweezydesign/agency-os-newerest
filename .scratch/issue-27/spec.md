# Issue 27: durable dry-run approval and bounded workflow

Status: ready-for-agent

Base: main d8369db1cd79d49d24f5875495d4cf4552292362; includes #24, #26, #28. Local branch fix/27-durable-approvals-workflow. #25 is untouched.

## Additive schema and transitions (documented before implementation)

PolicyGate gains executionState (claimed / uncertain / completed), claimToken, claimedAt, optional requestKey and requestFingerprint, and workflowRunId. Existing pending/approved/denied status remains compatible. Legacy pending records with no executionState can be claimed. Approval first atomically claims pending + no executionState, then runs the fake effect, then completes using the claim token. Denial matches only pending + no executionState. Neither failure nor restart removes a claim. Unknown outcomes fail closed, with no expiring lease or automatic retry. Successful/denied decision replay remains a safe conflict. Durable claim metadata is the minimum audit evidence even if action-log persistence fails. Reconciliation requires human investigation; no automatic re-execution mechanism is introduced.

Idempotent requests use a deterministic Mongo ObjectId derived from tenant + requestKey, verified against an immutable request fingerprint. The built-in \_id uniqueness closes the creation/crash window without a new unique-index migration. Old callers without requestKey retain create semantics. Pipeline replay uses a tenant/client/correlation-derived key; a conflicting payload fails closed.

Mastra uses its official MongoDBStore and a real createWorkflow/createStep registration. A bounded pipeline step invokes domain services and a human-boundary step suspends until the tenant-scoped gate is terminal. Resume never accepts an approval boolean as authorization: it reads the durable gate. No LLM execution is claimed. A durable per-run admission record binds tenant, run ID, input fingerprint and correlation ID and prevents concurrent start/restart; unknown admission outcomes remain blocked. Mastra snapshots persist separately from the domain gate; snapshot absence never licenses duplicate effects.

Beta workflow is opt-in and fake-only, validates reserved .test contacts, and uses an effect runner with no vendor imports. No migrations, staging writes, provider changes, CI changes, push, deployment, or live effects are authorized.

## Verification

Write regressions before production edits: approval concurrency, denial races, effect failure, completion write failure, restart/re-entry, request replay/conflict, tenant/role enforcement, explicit no-outbound effects. Run npm ci, lint, typecheck, all tests, build. Use an isolated local Mongo Docker process for integration and fresh Node-process checks. Exercise 39/40/69/70, invalid scores, missing contact, denial, approval and retry. Protected staging remains a separate blocked acceptance gate until publication is authorized; local proof is not staging proof.

## Recovery and compatibility

No database migration or existing-row rewrite. Do not roll back to old approval code while claimed gates exist: the old writer ignores executionState. Reconcile outstanding claims first or disable decision routes during rollback. Unknown effect outcomes require explicit operator reconciliation with independent evidence; this change intentionally does not provide a blind retry/reset endpoint. Legacy approved/denied rows remain terminal. New run records must not be deleted to recover a stuck run.
