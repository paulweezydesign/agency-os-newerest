# PR30 durable engine and operator integration

Base: 16d4228d3f216218e1473177d44f1e42e4235e71. Selected UI/reference: cb367cd54ec938c09a3a1c79ee32579a24159e9e.

Preserve PR30 pending-only decision CAS, atomic dry-run receipt, explicit dry-run recovery, blocked unknown real-effect outcomes, and unique tenant/client immutable reservation. Do not import older policy-gate or Client repository implementations.

Add optional engineVersion and engineState (idle/running/suspended/success/uncertain) to application runs. New records have version1/idle. One CAS claims start or resume; no time-based lease or restart of an ambiguous invocation. Old application-only records are inspectable but cannot be represented as persisted engine runs. MongoDBStore stores actual Mastra snapshots; human-approval step suspends and fresh-process resume restores engine state. Terminal gates alone never mark engine complete. Suspended admissions require a matching saved snapshot, and resume rechecks authoritative gates and original tenant/client identity. Uncertain admissions remain blocked; no arbitrary side-effect retries.

UI retains tenant/client-scoped request identity before send, reload inspection, double-click and cross-tab coordination, changed-input rejection, no silent legacy fallback. One immutable run per Client: new scenario requires a new synthetic .test Client. Existing PR30 gate recovery remains explicit.

Verification: baseline safeguards, regression tests before implementation, unit/API/controller/render tests, real isolated Mongo concurrent writes/restart/fresh-process resume and crash windows, lint/typecheck/full suite, ordinary/font-mocked build distinction, local Chromium synthetic UI, independent review. Protected Preview remains blocked by OAuth configuration and previous deployment denial. No security settings/deployments/push until local report.
