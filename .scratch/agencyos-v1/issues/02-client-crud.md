# 02 — Client CRUD

**What to build:** An agent-operator can create, list, and open a Client end-to-end (API + dashboard UI), scoped to the tenant, with tests covering the happy path and authz denial.

**Blocked by:** 01 — Auth shell + tenant dashboard

**Status:** ready-for-agent

- [ ] Operator can create a Client and see it in the clients list
- [ ] Operator can open Client detail
- [ ] Unauthenticated or wrong-role access is rejected
- [ ] Clients are tenant-scoped
- [ ] Tests cover create/list/get and RBAC denial
