# OpenAI bounded synthetic provider

Status: ready-for-human

Wire the existing fixed task-to-brief path to the explicitly requested OpenAI API model `gpt-6-astra`, via Mastra's Responses transport. Keep the runtime off until the user configures their own server environment. Do not collect, print, save, or transmit a real key while implementing or testing.

Preserve the authenticated operator, configured tenant/Project, one-run-per-Project admission, immutable Task, transaction, timeout, and no-replay controls. Do not connect the broad agent tools, enable production, or change deployment settings. Use one model with no fallback, two one-step stages, 1,500/3,000 output-token ceilings, low reasoning, standard service tier, no provider response storage, and no automatic retry. Reject non-complete results.

Validate configuration before importing the provider or connecting Mongo. Require the exact requested model (API or Mastra identifier), a nonblank server key, and the existing explicit enablement/scope. Reject endpoint overrides. Return sanitized errors only. Document secure user-managed setup and the remaining account, cost, replica-set, live-model, and Preview acceptance gates.

Tests must use synthetic credentials and intercepted HTTP only. Verify the real pinned Mastra provider emits `/v1/responses`, exact model and constraints; test structured output, tool call, rate-limit/non-retry, incomplete output and missing credentials. Run lint, typecheck, ordinary tests and build. Live paid requests and real-key handling are out of scope.

Verified on 2026-11-08: full `npm run build` passed, including lint, typecheck, 391 tests and production page generation. All 56 opt-in tests remain skipped. Independent source and transport review found no blocking issue. No real credential, model request or database acceptance was used. Publish only the separate `feat/openai-bounded-provider` branch; do not alter the candidate PR, merge or deploy.
