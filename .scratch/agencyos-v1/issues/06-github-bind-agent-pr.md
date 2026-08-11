# 06 — GitHub bind + agent PR

**What to build:** An operator can link a GitHub repo to a Project. From a Task, an agent flow opens a branch and pull request on that repo. Merging remains human-owned.

**Blocked by:** 05 — Project Manager agent chat

**Status:** ready-for-agent

- [ ] Project can store a linked GitHub repo binding
- [ ] Agent/tool flow opens a branch and PR from a Task
- [ ] No agent path merges to protected branches
- [ ] Failures surface actionable errors and are logged
- [ ] Integration tests pass with mocked GitHub
