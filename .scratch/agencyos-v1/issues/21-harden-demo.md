# 21 — Harden + demo

**What to build:** AgencyOS meets the locked spine’s definition of done: seed and demo scripts, architecture/workflows/runbooks docs, and lint/typecheck/test/build all green across the critical paths.

**Blocked by:** 06 — GitHub bind + agent PR, 07 — Linear tracker mirror, 08 — Monday tracker mirror, 11 — Brief → SOW → MVP scaffold, 12 — Client pipeline, 13 — Research: Exa + RAG, 17 — Change Request + UAT, 18 — Figma in design review, 19 — Slack notifications, 20 — Stripe deposit

**Status:** ready-for-agent

- [ ] Seed script creates sample Clients, Projects, Tasks, and agent artifacts
- [ ] Demo script covers lead → onboard and brief → SOW → scaffold paths
- [ ] `docs/architecture.md`, `docs/workflows.md`, and `docs/runbooks.md` are complete enough to operate
- [ ] External API retries/timeouts/circuit-breaker behavior is audited
- [ ] `lint`, `typecheck`, `test`, and `build` all pass
