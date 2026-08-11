# 07 — Linear tracker mirror

**What to build:** Task status and assignee sync bidirectionally with Linear. Scope and description stay AgencyOS-owned; conflicting tracker edits to those fields are rejected or parked, with operator-visible sync logging.

**Blocked by:** 04 — Tasks + action audit

**Status:** ready-for-agent

- [ ] Creating/updating a Task pushes status/assignee to Linear
- [ ] Linear status/assignee webhooks update the Task in Mongo
- [ ] Scope/description remain AgencyOS-owned under conflict
- [ ] Sync outcomes are visible to operators
- [ ] Tests cover mapping and conflict rules
