# Issue 27: durable workflow operator UI

Local base: `166f57a8b74d287de254a1c912ab7753a87005ca` on the beta branch. This slice is isolated on `fix/27-durable-workflow-operator-ui`. It has not been pushed, deployed, or combined with theme PR #25.

## Operator behavior

The Client detail page uses the shared server-side predicate `AGENCYOS_BETA_WORKFLOW=dry-run` and `VERCEL_ENV != production` to select the durable form. When enabled, it calls only `POST /api/clients/<clientId>/pipeline/workflow`, with operations `start`, `inspect`, and `resume`. It never falls back to the legacy pipeline endpoint on an error. With opt-in off, the existing legacy form remains explicit and unchanged in behavior.

Starting a run requires the Client's saved contact to be a valid `.test` address. There is no beta email override field. Existing runs remain inspectable if the saved Client contact changes. Backend authorization and fake-only effect enforcement remain in place; browser flags do not authorize execution.

Before any start request, the controller saves `{version, requestId, leadScore}` under a tenant/client-specific localStorage key. It does not store contacts, credentials, gate payloads, snapshots, or responses. A synchronous guard suppresses repeated clicks before React updates, and a scoped Web Lock coordinates browser tabs. Missing Web Locks or inaccessible storage fails closed without sending a start. Reload restores the identity and inspects the server. Lost responses can be retried with exactly the same request UUID and score. A different score under an existing identity is rejected.

The controller offers a deliberately new request identity only through **Start new run with this score**, after re-inspecting and confirming that the previous admission completed and its gates are terminal. There is no clear/reset/force-retry control. Running/interrupted, uncertain, claimed, and unconfirmed outcomes cannot obtain a replacement identity through normal controls. If another tab changes the saved identity, stale controls stop and require inspection. Removing or corrupting storage while the form is mounted also blocks progression while retaining the known identity.

Deleting browser data and then fully reloading remains a browser-retention limitation: the browser cannot recover an identifier it no longer possesses. This does not reset any durable backend admission or gate. Operators must review recorded run/request IDs rather than treating browser data deletion as recovery. The UI retains the latest run per tenant/client, not a run-history database.

## Truthful status and safe resume

Inspection now returns a minimal live gate summary from Mongo, filtered by tenant and workflow run ID. This avoids presenting stale pending status from a suspended Mastra snapshot after an operator has approved or denied the actual gate. Admission and gate states are shown separately, with run/correlation IDs and gate links. Running is described as running **or interrupted**, not proof of active execution. Uncertain or claimed execution is shown as blocked for review. Completed effects are labeled dry runs, with no delivery claim or invented teammate-agent execution.

**Resume after decision** is available only for a suspended admission with terminal gates. The controller re-inspects immediately before resume and sends only the request UUID and operation, never an approval boolean. The backend remains authoritative. Gate links include a tenant-scoped lookup so an older gate remains reachable after aging out of the recent queue. A verified result refreshes Client detail data without changing the form's tenant/client key or controller identity.

## Verification and review

Regression coverage was written before implementation. The initial new-feature test run failed because the controller module did not yet exist. Coverage now includes reload, same-request retry, repeated clicks, invalid scores, changed payload, tenant/client separation, pending and terminal gates, blocked admission/execution states, rejected and malformed responses, storage removal/corruption/write failure, stale tabs, SSR form selection, status rendering, contact constraints, gate links, and the opt-in/production predicate. Vitest's JSX transform was enabled for server-rendering tests; no new dependency or CI/provider setting was introduced.

Executed commands:

```sh
npm run lint
npm run typecheck
npm test
docker start agency27-mongo
node scripts/verify-beta-mongo.mjs
npm run build
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/agency27-font-mocks.cjs npm run build
git diff --check
```

- Lint and typecheck passed.
- Full suite: 74 files / 288 tests passed; the three opt-in Mongo phase tests are skipped in the ordinary suite.
- The isolated local Mongo driver passed all five phases, including three intentional process kills. New assertions verify that inspection shows approved/denied gates while the workflow is still suspended, before resume. Evidence database: `agency27_test_4eb91bfdc2b0427092cca0deeebf9dfe`, local port 27027. No deployed database was accessed.
- Ordinary build: failed fetching the existing Geist/Geist Mono fonts from Google, preserving the known environment network limitation.
- Supplementary font-mocked build: passed compilation and page generation. This is not evidence of normal font fetching or visual/browser correctness. No application font code or provider configuration was changed, and its generated build output is removed after verification.
- Independent review identified two issues during work: a removed storage key could expose a fresh-start path for a known run, and Client detail data could remain stale after a workflow update. Both were fixed and re-reviewed. No remaining blocking findings were reported. Independent focused coverage passed 43 tests; the refresh follow-up passed seven rendering tests.
- No browser, protected staging, theme-branch integration, or GitHub CI verification was performed for this UI slice.

## Remaining acceptance boundary

This code is local and unpublished. The existing Preview does not contain this UI slice; the supplied staging context also says the branch-scoped dry-run flag has not been applied to a fresh deployment. No deployment attempt was retried. A later authorized publication and protected Preview visit are required to exercise the real browser/operator path.

When that is authorized, verify: open a synthetic Client; start and repeat-click once; reload and inspect the same identity; decide the gate through its link; return and inspect; resume; confirm terminal state and refreshed Client stage; deliberately start a new score; verify another tenant/client does not show the earlier saved run. Inspect network requests to confirm there is no legacy fallback. Test storage/network failure and blocked execution states without clearing or replacing backend records.
