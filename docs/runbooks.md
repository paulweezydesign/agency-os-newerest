# Runbooks

## Local bootstrap

```bash
npm install
cp .env.example .env   # if present; set MONGODB_URI for persisted paths
npm run seed           # in-memory seed smoke via vitest
npm run demo           # pipeline + artifact demo paths
npm run lint && npm run typecheck && npm run test && npm run build
```

Seed users (Credentials): `admin@agencyos.local` / `admin-dev`, `operator@agencyos.local` / `operator-dev`, `client@agencyos.local` / `client-dev` (portal client id `SEED_CLIENT_ID`).

## External API resilience

| Integration | v1 seam | Retries / timeouts |
| --- | --- | --- |
| Resend | in-memory client | Fail on invalid recipient; HTTP adapter should use `withRetry` |
| Slack | in-memory client | Fail-open notifier; errors logged to AgentActionLog |
| Stripe | in-memory + webhook verify | Deposit create/webhook; wrap HTTP with `withRetry` when live |
| Figma | in-memory client | Design-review attach uses `withRetry` for rate-limit/unavailable |
| Exa / Linear / Monday / GitHub | in-memory clients | Sync logs record conflicts; HTTP adapters should set 10s timeout + 2 retries |
| Shared helper | `src/lib/http/with-retry.ts` | Exponential backoff, TimeoutError, configurable `shouldRetry` |

Circuit breaker: v1 does not trip a global breaker; prefer fail-open notifications and logged sync rejects. Add per-client breakers when live HTTP clients land.

## Correlation IDs

Pass `x-correlation-id` (or generate) through task/artifact/gate/Slack paths. Query AgentActionLog by `tenantId` + `correlationId` when debugging a failed demo effect or Figma attach.

## Common failures

- **Figma attach 400** — invalid URL or mocked file missing; seed key `AbCdEf123` exists in the demo client.
- **Policy gate stuck pending** — approve/deny as operator; check Slack/#agencyos-ops mock messages in tests.
- **Portal 404** — ensure Client id matches `SEED_CLIENT_ID` for the seed client user.
- **Stripe webhook reject** — signature/verification failure in `webhook-api`; use test helper client.

## Incident checklist

1. Capture `correlationId` from the failing request.
2. List AgentActionLog entries for that id.
3. Confirm which external seam failed (Slack/Figma/Stripe/tracker).
4. Retry only idempotent writes; do not re-approve already decided gates.
