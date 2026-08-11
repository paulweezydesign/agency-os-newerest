# 19 — Slack notifications

**What to build:** Operators receive Slack notifications for policy-gate events, budget threshold crossings, and tracker sync failures.

**Blocked by:** 09 — Policy gate queue, 16 — Budget guardrails

**Status:** done

- [x] Policy-gate create/approve/deny can notify Slack
- [x] Budget 80/100/120 alerts can notify Slack
- [x] Tracker sync failures can notify Slack
- [x] Notification sends are logged; failures are actionable
- [x] Tests cover notification triggers with mocked Slack
