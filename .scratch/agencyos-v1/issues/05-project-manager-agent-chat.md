# 05 — Project Manager agent chat

**What to build:** An agent-operator can stream-chat with the Project Manager (agent). It decomposes and manages work by listing/creating Tasks via tools only — it does not complete deliverable work itself. Every tool call is logged.

**Blocked by:** 04 — Tasks + action audit

**Status:** done

- [x] Streaming chat UI talks to the Project Manager agent
- [x] Agent can list and create Tasks only through tools
- [x] Agent instructions enforce orchestrate-only (no deliverable execution)
- [x] Every tool call appears in AgentActionLog
- [x] Tests cover tool schema validation and logged tool invocation
