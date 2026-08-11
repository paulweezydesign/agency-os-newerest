# 12 — Client pipeline (prospect → nurture → onboard)

**What to build:** The client-pipeline workflow can take a lead through prospect → qualify → nurture → onboard with lead-score branching. Email to the Client goes through Resend only after policy-gate approval.

**Blocked by:** 10 — Seed roster + spawn cap, 09 — Policy gate queue

**Status:** ready-for-agent

- [ ] Pipeline runs with conditional branching by lead score
- [ ] Prospector/Nurture/Onboarding teammates participate via tools
- [ ] Client-facing email is policy-gated before Resend send
- [ ] Pipeline progress is visible on the Client record
- [ ] Integration test covers a happy-path pipeline run (mocked email)
