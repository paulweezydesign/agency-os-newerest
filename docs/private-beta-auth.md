# Private-beta authentication configuration

## Operator sign-in

AgencyOS uses Auth.js GitHub OAuth for private-beta operators. Authorization is **by immutable numeric GitHub account ID**, not GitHub username or email. Unknown accounts are denied. Changing the allowlist revokes access on the next server-side session check. Only one tenant (`tenant-default`) is supported in this beta.

Create a GitHub OAuth App with the correct **private deployment** origin and callback URL `https://YOUR-PRIVATE-HOST/api/auth/callback/github`. Keep OAuth credentials and AUTH_SECRET only in a private deployment secret store, never in Git.

Required values:
- `AUTH_SECRET`: strong random server secret (replace the example)
- `AUTH_URL`: private deployment URL, e.g. `https://agencyos.example.com`
- `AUTH_GITHUB_ID`: GitHub OAuth App client ID
- `AUTH_GITHUB_SECRET`: GitHub OAuth App secret
- `AGENCYOS_GITHUB_ADMIN_IDS`: comma-separated numeric GitHub user IDs allowed as admins
- `AGENCYOS_GITHUB_OPERATOR_IDS`: comma-separated numeric GitHub user IDs allowed as operators

The admin allowlist takes precedence if an account appears in both. Never add arbitrary GitHub users to either list. Never derive roles or tenant IDs from user-supplied claims, public login names, or profile emails.

**Local-only demo login:** Set `AGENCYOS_ENABLE_DEMO_AUTH=true` only while `NODE_ENV=development` to opt into the original seed-password sign-in. It is never registered in production, even if the flag is set there. The login form never pre-fills passwords or publishes demo credential values. Do not connect a development-demo deployment to real client data.

**Client portal:** GitHub operator identities do not grant portal/client permissions. The old portal seed user is only accessible in explicit development-demo mode. Production client login/provisioning remains a later, separate security milestone; do not treat it as shipped.

## Security verification before release

- [ ] Confirm unlisted GitHub IDs cannot sign in or access operator APIs.
- [ ] Confirm both admin and operator roles map to the correct fixed tenant.
- [ ] Confirm GitHub allowlist removal revokes an existing session.
- [ ] Confirm `AGENCYOS_ENABLE_DEMO_AUTH=true` cannot activate demo auth in production.
- [ ] Confirm the sign-in form does not expose credentials.
- [ ] Test OAuth callback, CSRF/session cookies, and sign-out on the actual HTTPS staging origin.
- [ ] Verify every protected API rejects anonymous and client-role requests.
- [ ] Set explicit `AUTH_URL` and hardened proxy configuration; do not enable host trust on untrusted inbound headers.
- [ ] Run `npm run typecheck && npm test && npm run lint && npm run build` on a clean checkout before merging.
- [ ] Verify tenant isolation, audit trails, OAuth credentials/secret rotation and rollback.
