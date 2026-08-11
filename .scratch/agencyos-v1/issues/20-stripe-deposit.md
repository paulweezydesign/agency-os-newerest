# 20 — Stripe deposit

**What to build:** An operator or Client can start a Stripe Checkout deposit for a Project. Money movement is policy-gated. E-sign remains deferred.

**Blocked by:** 09 — Policy gate queue, 03 — Project under Client

**Status:** done

- [x] Deposit Checkout session can be created for a Project
- [x] Initiating/collecting deposit respects the policy gate
- [x] Successful deposit is recorded on the Project
- [x] Webhook verification is covered by tests
- [x] No e-sign vendor is introduced
