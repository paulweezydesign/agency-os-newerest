# AgencyOS v1 — private beta readiness

## Goal
Release a private, single-tenant operator beta, not a public or fully automated production agency. Real Clients and Projects may be managed only after authentication, data safety, and operations gates are met.

## Minimum functional acceptance
- Operator signs in via non-demo authentication; roles and tenant boundaries enforced.
- Client name and contact email save durably in MongoDB and can be retrieved after restart.
- Operator creates Projects and Tasks; actions are auditable.
- Lead score moves a Client through the existing pipeline; outbound actions queue for human approval.
- Denying an approval never sends; approving an action cannot create a duplicate side effect.
- Project Manager agent can list/create Tasks through approved audited tools.
- Interface defaults to accessible dark mode; light mode is readable and persists.

## Hard release blockers
- [ ] Remove publicly known seed passwords from deployed authentication; rate-limit sign-in and test roles.
- [ ] Replace or explicitly disable demo integration effects (in-memory Resend, Stripe, Slack, tracker clients) in private beta.
- [ ] Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; record results.
- [ ] Verify MongoDB backups/restore, auth secrets, least-privilege database access and tenant boundaries.
- [ ] Verify the approval queue, failure outcomes, and retry/idempotency against persisted data.
- [ ] Validate keyboard navigation, mobile layouts, focus, and AA text contrast in both themes.
- [ ] Configure private HTTPS staging, health check, logging, rollback and recovery procedures.
- [ ] Review open PR #24 and its contact-email regression coverage before merging.

## Defer from this beta
- Public lead capture and live prospecting.
- Live payments and automatic outbound emails.
- Fully registered Mastra production workflow and broad multi-agent delegation.
- General public client onboarding and multi-tenant launch.

## Rollout rule
Do not deploy publicly, connect live third-party side effects, or merge unreviewed code. First finish and verify a private staging smoke test. **Current status: not production-ready.**
