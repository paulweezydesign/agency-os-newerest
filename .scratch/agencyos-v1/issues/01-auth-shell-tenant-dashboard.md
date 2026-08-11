# 01 — Auth shell + tenant dashboard

**What to build:** An operator can sign in with Auth.js and land on an empty AgencyOS dashboard. Session and data paths carry `tenantId` (single tenant in practice). Lint/typecheck/test scripts exist and a smoke test passes.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Auth.js v5 sign-in works for `admin` and `agent-operator` roles
- [ ] Dashboard shell renders for an authenticated operator
- [ ] `tenantId` is present on the authenticated session/data path
- [ ] MongoDB connection succeeds in the app boot path
- [ ] Unit/smoke test harness is green
