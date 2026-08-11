# External API retries via shared helper

Live vendor HTTP is largely behind in-memory clients in v1. Introduce `withRetry` (`src/lib/http/with-retry.ts`) as the standard timeout + exponential-backoff seam for those adapters. Design-review Figma attach uses it now; Resend/Slack/Stripe/Exa/Linear/Monday/GitHub HTTP ports should call the same helper when wired. Global circuit breakers are deferred until live traffic warrants them; fail-open notifications and sync-log rejects remain the v1 degradation model.
