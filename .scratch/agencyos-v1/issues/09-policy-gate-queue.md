# 09 — Policy gate queue

**What to build:** When an agent attempts a client-facing or money action, it enters an approve/deny queue for admin or agent-operator. Pending or denied actions do not execute side effects.

**Blocked by:** 05 — Project Manager agent chat

**Status:** done

- [x] Gated actions create a pending approval item instead of executing
- [x] Admin or agent-operator can approve or deny from the UI
- [x] Approve executes the side effect once; deny does not
- [x] Gate decisions are written to AgentActionLog
- [x] Tests cover pending/approve/deny paths
