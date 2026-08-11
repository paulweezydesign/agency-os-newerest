# 07 — Linear tracker mirror

**What to build:** Task status and assignee sync bidirectionally with Linear. Scope and description stay AgencyOS-owned; conflicting tracker edits to those fields are rejected or parked, with operator-visible sync logging.

**Blocked by:** 04 — Tasks + action audit

**Status:** done

- [x] Creating/updating a Task pushes status/assignee to Linear
- [x] Linear status/assignee webhooks update the Task in Mongo
- [x] Scope/description remain AgencyOS-owned under conflict
- [x] Sync outcomes are visible to operators
- [x] Tests cover mapping and conflict rules
