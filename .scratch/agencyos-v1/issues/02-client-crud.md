# 02 — Client CRUD

**What to build:** An agent-operator can create, list, and open a Client end-to-end (API + dashboard UI), scoped to the tenant, with tests covering the happy path and authz denial.

**Blocked by:** 01 — Auth shell + tenant dashboard

**Status:** done

- [x] Operator can create a Client and see it in the clients list
- [x] Operator can open Client detail
- [x] Unauthenticated or wrong-role access is rejected
- [x] Clients are tenant-scoped
- [x] Tests cover create/list/get and RBAC denial

## Comments

- 2026-08-11: Client service + mongoose repo, `/api/clients` handlers with operator allow / unauth 401 / client-role 403, dashboard list/create/detail UI. Vitest 21 passing (was 9). `npm test`, `typecheck`, `lint` green.
