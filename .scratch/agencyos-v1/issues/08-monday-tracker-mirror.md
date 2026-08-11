# 08 — Monday tracker mirror

**What to build:** Task status and assignee sync bidirectionally with Monday.com under the same ownership rules as Linear (AgencyOS owns scope/description).

**Blocked by:** 04 — Tasks + action audit

**Status:** done

- [x] Creating/updating a Task pushes status/assignee to Monday.com
- [x] Monday status/assignee webhooks update the Task in Mongo
- [x] Scope/description remain AgencyOS-owned under conflict
- [x] Sync outcomes are visible to operators
- [x] Tests cover mapping and conflict rules
