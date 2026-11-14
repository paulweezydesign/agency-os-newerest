# Fail closed for synthetic webhook routes

Status: ready-for-human
Base: verified combined candidate `9e9cfec5a80aa1e803840180e897c5f7b2500649`
Branch: `fix/webhook-validation-before-storage`

## Confirmed issue and scope

All three webhook routes initialized database-backed dependencies before rejecting malformed payloads or a bad fixture signature. Linear/Monday have no provider authentication; Stripe uses an in-memory fixture verifier. Merely reordering storage would not make those deployed endpoints safe.

The fix rejects production, unknown/unset runtime, and every Vercel environment with 503 before parsing or initializing dependencies. Development/test fixture behavior remains available, with lazy storage only after the existing validation passes. No provider integration, credentials, signature algorithm, dependencies, production settings, or database schema changed.

See `docs/webhook-safety.md` for the explicit warning: local development/test routes remain unauthenticated, must bind loopback, and must use isolated fictional data. Environment labels are not network authentication. Full provider verification, tenant binding, replay/idempotency, and strict Stripe event parsing are future work, not established here.

## Fresh verification

- New route suite before fix: 40 failed, 7 passed. After fix: all 47 passed.
- Focused suite including existing webhook API cases: 53 passed; independently rerun by reviewer.
- ESLint, TypeScript, and `git diff --check`: passed.
- Full ordinary tests: 634 passed, 58 opt-in Mongo tests skipped. Skips are not passes.
- Ordinary production build: blocked by DNS `EAI_AGAIN fonts.googleapis.com`, including one reviewed retry. No application compile failure is claimed from this network result.
- Production compilation with the existing Google Fonts test mock: passed, with pre-existing Mastra dynamic-dependency and Auth.js/Jose Edge compression warnings. This is not normal font-download acceptance.
- Nine local HTTP checks passed with no Mongo URI or provider credentials. Production rejected both plausible fixtures and malformed requests for Linear, Monday, Stripe; local development returned the existing 400 errors for malformed tracker payloads and invalid Stripe signatures. Both owned servers stopped. Exact results: `http-evidence.json`.
- Independent source review found no blocking issue within this synthetic-only scope. Known malformed signed Stripe fixture parsing can still throw; no production authenticity or payment idempotency is claimed.

## Reproduce local HTTP evidence

Use this clean worktree with no local `.env` files, and first produce a successful build (the font-mocked build is acceptable for this route-only check). Then:

```sh
node .scratch/webhook-safety/verify-http.mjs
```

The harness uses loopback port 3326, sanitizes the child environment, never provides a Mongo URI/provider key, and terminates its owned processes. Do not run concurrently with another build/server in this checkout. It overwrites only its generated `http-evidence.json`; temporary logs remain in `/tmp`.

No push, PR update, merge, deployment, paid model request, real provider request, or production-data operation was performed.
