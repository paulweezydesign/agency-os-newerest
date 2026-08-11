# 03 — Project under Client

**What to build:** An agent-operator can create, list, and open a Project belonging to a Client, including timeline and budget fields, from the dashboard.

**Blocked by:** 02 — Client CRUD

**Status:** done

- [x] Operator can create a Project on a Client
- [x] Project list and detail show timeline and budget fields
- [x] Project is tenant-scoped and linked to its Client
- [x] Wrong-role access is rejected
- [x] Tests cover create/list/get under a Client

## Comments

- 2026-08-11: Implemented Project service/API/mongoose + dashboard under Client detail. 36 tests green; typecheck/lint pass.
