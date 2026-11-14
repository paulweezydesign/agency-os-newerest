# Authorize session routes before initializing storage

Status: implemented locally; not pushed or deployed
Base: `feat/openai-bounded-provider` at `9ba0a3700cf4e9e51e11c6116a63aeb9b7e24e09`

## Verified problem

An anonymous local `GET /api/clients` returned 500 after 30.8 seconds with Mongo unavailable, because the route awaited `getClientService()` before the handler could return 401. The same eager dependency pattern affected 23 session-authenticated route files, including operator APIs, mixed operator/client APIs, and Project Manager chat.

## Change

- Guard service/agent construction with the existing operator and/or portal access resolvers, leaving handler checks and resource ownership checks in place.
- Preserve 401/403 JSON bodies, operator/admin/client roles, seed-linked client requirements, unknown-agent 404, and change-request decision validation precedence.
- Move UAT GET initialization into its existing authorized branches.
- Do not modify credentials, auth settings, database models, provider configuration, webhooks, or deployment state.

## Fresh local verification

- Regression matrix before change: 93 failed / 81 passed. After change: 174 passed.
- Matrix covers every affected route plus already-safe UAT POST/sign-off and spawned-agent chat, with anonymous/wrong-role denial before storage; permitted operator/client access; unchanged tenant forwarding and client ownership behavior.
- ESLint and TypeScript: passed.
- Production build: passed with upstream Mastra dynamic-import and jose Edge-runtime warnings.
- Ordinary suite: 565 passed, 56 opt-in Mongo tests skipped.
- Local HTTP with absent loopback Mongo, disabled bounded provider and synthetic development login: 15 checks passed. Warm anonymous clients GET was 401 in 21ms; synthetic client GET was 403 in 32ms. No model calls or production traffic. Owned local app stopped.
- Independent source review: no introduced permission/response regressions or missed Mongo-backed session routes found.

## Boundaries and follow-ups

- Browser visual/keyboard/mobile QA remains unverified: sandboxed Chromium cannot launch in this environment. Do not treat HTTP markup checks as browser acceptance.
- Workflow/agent-run routes already construct dependencies lazily after access checks. RAG getters are in-memory, not eager Mongo connections.
- Linear/Monday/Stripe webhook routes also initialize services before signature verification. They use a separate auth contract and are intentionally outside this patch. Follow up with signature-before-storage regression coverage.
- Separate pre-existing decision ownership risk identified in change-request/design-review handlers: URL project ownership is checked before a decision ID is proven to belong to that project. This is not fixed by the session initialization guard; address in a separate change.
