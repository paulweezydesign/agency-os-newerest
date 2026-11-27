# Bind decisions to the authorized project before mutation

Status: implemented locally; not pushed or deployed
Parent checkpoint: `7f2b63ab6f4048845a1b7362fd12bce95b792fe8` (session initialization guard)

## Verified issue

The change-request and design-review decision APIs checked the client ownership of the URL project, but then passed only tenant ID + decision ID into their decision service. A caller could supply an owned project URL and a decision ID belonging to another client in the same tenant.

- Change-request client path mutated the other project's record and returned success.
- Change-request operator path and design-review client path compared the resulting project only after mutation, so a 404 did not prevent the change.
- Reproduced locally using actual domain services and synthetic in-memory repositories, not production data: eight approve/reject cases called repository `update` despite a mismatched project ID. Twelve valid/ownership/tenant-isolation controls passed.

## Minimal fix

Require `projectId` in both decision service inputs. All three API call sites forward the URL project ID. After the existing tenant-scoped record lookup, each service rejects a project mismatch with the existing not-found error before state checks or any repository update. Existing auth/portal/tenant/validation behavior and positive decisions remain unchanged.

Current repository update contracts cannot reassign a record's project. No repository or persistence change is included. A future persistent repository should retain this invariant and/or scope the update query by project.

## Verification

- New ownership suite: 8 failures before the fix, 20/20 passing after.
- New cases assert zero updates and unchanged stored records on mismatches, cover both decisions and applicable client/operator/admin roles, and preserve positive, unowned-URL-project, and cross-tenant behavior.
- Focused ownership + existing service/API tests: 28 passed.
- ESLint, TypeScript, and git diff checks passed.
- Full ordinary suite: 585 passed, 56 opt-in Mongo tests skipped.
- Independent read-only review found no blocking issue, missing API call site, or existing project-reassignment path.
- No production, provider, browser, webhook, schema or infrastructure changes; no push/deploy. Combined-candidate build and replica-set tests remain an integration step.
