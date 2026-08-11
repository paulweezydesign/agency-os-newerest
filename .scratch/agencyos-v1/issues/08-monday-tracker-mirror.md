# 08 — Monday tracker mirror

**What to build:** Task status and assignee sync bidirectionally with Monday.com under the same ownership rules as Linear (AgencyOS owns scope/description).

**Blocked by:** 04 — Tasks + action audit

**Status:** ready-for-agent

- [ ] Creating/updating a Task pushes status/assignee to Monday.com
- [ ] Monday status/assignee webhooks update the Task in Mongo
- [ ] Scope/description remain AgencyOS-owned under conflict
- [ ] Sync outcomes are visible to operators
- [ ] Tests cover mapping and conflict rules
