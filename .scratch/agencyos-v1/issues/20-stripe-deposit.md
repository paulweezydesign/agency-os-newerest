# 20 — Stripe deposit

**What to build:** An operator or Client can start a Stripe Checkout deposit for a Project. Money movement is policy-gated. E-sign remains deferred.

**Blocked by:** 09 — Policy gate queue, 03 — Project under Client

**Status:** ready-for-agent

- [ ] Deposit Checkout session can be created for a Project
- [ ] Initiating/collecting deposit respects the policy gate
- [ ] Successful deposit is recorded on the Project
- [ ] Webhook verification is covered by tests
- [ ] No e-sign vendor is introduced
