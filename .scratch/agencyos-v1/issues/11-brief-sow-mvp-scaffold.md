# 11 — Brief → SOW → MVP scaffold

**What to build:** An operator can run the agency-delivery path so a Project gains a brief, SOW, and MVP scaffold artifacts visible on project detail. Sending the SOW to a Client is policy-gated.

**Blocked by:** 05 — Project Manager agent chat, 09 — Policy gate queue

**Status:** done

- [x] `createProjectBrief` / `generateSOW` / `buildMVPScaffold` produce persisted Project artifacts
- [x] Artifacts appear on Project detail UI
- [x] SOW send to Client goes through the policy gate
- [x] Workflow/tool failures are logged with actionable errors
- [x] Tests cover happy path persistence and gated send
