# 04 — Tasks + action audit

**What to build:** An agent-operator can manage Tasks on a Project board. Every Task mutation writes an AgentActionLog entry with a correlation ID so work is observable.

**Blocked by:** 03 — Project under Client

**Status:** ready-for-agent

- [ ] Operator can create/update/list Tasks on a Project
- [ ] Task board UI shows Tasks for the Project
- [ ] Each mutation writes AgentActionLog with correlation ID
- [ ] Task is the system of record in Mongo (no external tracker required yet)
- [ ] Tests cover Task CRUD and audit log write
