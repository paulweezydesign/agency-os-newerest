# 04 — Tasks + action audit

**What to build:** An agent-operator can manage Tasks on a Project board. Every Task mutation writes an AgentActionLog entry with a correlation ID so work is observable.

**Blocked by:** 03 — Project under Client

**Status:** done

- [x] Operator can create/update/list Tasks on a Project
- [x] Task board UI shows Tasks for the Project
- [x] Each mutation writes AgentActionLog with correlation ID
- [x] Task is the system of record in Mongo (no external tracker required yet)
- [x] Tests cover Task CRUD and audit log write

## Comments

- 2026-08-11: Tasks + AgentActionLog shipped with board UI and x-correlation-id. 43 tests green; typecheck/lint pass.
