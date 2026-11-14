# Webhook availability and local fixture safety

The current Linear, Monday, and Stripe webhook endpoints are **synthetic fixtures, not live provider integrations**.

- Linear and Monday accept simplified fixture payloads and do not authenticate provider signatures.
- Stripe uses an in-memory test client. Its fixture signature comparison is not Stripe's production signature verification.
- All three HTTP routes return `503 {"error":"Live webhooks are not configured"}` outside `NODE_ENV=development` or `NODE_ENV=test`, and in every Vercel environment. This happens before payload parsing, mock-client construction, or database initialization.
- Adding provider secrets does not enable these endpoints. Do not change `NODE_ENV` or remove deployment markers to enable webhook delivery.

## Local fixture boundary

Development and test routes remain **unauthenticated** to preserve the existing synthetic test contract. `NODE_ENV` is a trusted server-configuration check, not network authentication. A non-Vercel development/test server exposed to other machines is still unsafe: a caller could submit fixture tracker updates or a test-signature deposit event against its configured database.

Run local fixtures only on loopback and only against an isolated database containing fictional records:

```sh
npm run dev -- --hostname 127.0.0.1
```

The ordinary `npm run dev` command does not itself enforce loopback binding. Do not expose this server through a public tunnel, reverse proxy, port forwarding, or shared development deployment, and do not connect it to production/shared data. A `Host` header check would not prove network isolation and is deliberately not presented as authentication.

Within this boundary, malformed Linear/Monday payloads return their existing 400 response before storage initialization. Stripe verifies its fixture signature and existing checkout metadata checks before obtaining deposit storage. Valid synthetic behavior remains available. The Stripe fixture parser still has limited schema handling; malformed signed fixture JSON can throw. It is not a live event parser.

## Before any live webhook integration

Keep these deployed routes unavailable until a separately reviewed implementation provides provider-specific verification over the original request bytes, configured server-side secrets, authenticated tenant/account binding, full event-schema handling, replay protection/idempotency, and tests proving invalid events cannot initialize storage or mutate data. In particular, the current deposit fixture does not establish safe handling of repeated real payment events.

No provider settings, signing secrets, endpoint subscriptions, credentials, or deployed services were changed by this guard.

## Focused regression command

```sh
npm test -- --run src/app/api/webhooks/webhook-routes.test.ts src/lib/linear/linear-webhook-api.test.ts src/lib/monday-sync/monday-webhook-api.test.ts src/lib/stripe/webhook-api.test.ts
```
