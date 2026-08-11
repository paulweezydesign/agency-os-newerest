# 01 — Auth shell + tenant dashboard

**What to build:** An operator can sign in with Auth.js and land on an empty AgencyOS dashboard. Session and data paths carry `tenantId` (single tenant in practice). Lint/typecheck/test scripts exist and a smoke test passes.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Auth.js v5 sign-in works for `admin` and `agent-operator` roles
- [x] Dashboard shell renders for an authenticated operator
- [x] `tenantId` is present on the authenticated session/data path
- [x] MongoDB connection succeeds in the app boot path
- [x] Unit/smoke test harness is green

## Comments

- 2026-08-11: Implemented Next.js 15 + Auth.js credentials seed users, `getSessionContext`, `connectMongo`, dashboard gate, Vitest suite (9 tests). `npm test`, `typecheck`, `lint`, and `build` pass.
