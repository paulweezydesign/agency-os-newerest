# 12 — Client pipeline (prospect → nurture → onboard)

**What to build:** The client-pipeline workflow can take a lead through prospect → qualify → nurture → onboard with lead-score branching. Email to the Client goes through Resend only after policy-gate approval.

**Blocked by:** 10 — Seed roster + spawn cap, 09 — Policy gate queue

**Status:** done

- [x] Pipeline runs with conditional branching by lead score
- [x] Prospector/Nurture/Onboarding teammates participate via tools
- [x] Client-facing email is policy-gated before Resend send
- [x] Pipeline progress is visible on the Client record
- [x] Integration test covers a happy-path pipeline run (mocked email)
