# Workflows

## Lead → onboard (client pipeline)

1. Create or locate a Client with `contactEmail`.
2. Run `ClientPipelineService.run` with a lead score.
3. Score ≥ 70 → stages `prospect` → `qualify` → `onboard` and queue a policy-gated welcome email.
4. Score 40–69 → `nurture` + gated nurture email.
5. Score &lt; 40 → `disqualified`.
6. Operators approve/deny the gate in the policy-gate queue; demo effect runner + Slack notify on transitions.

## Brief → SOW → scaffold

1. On a Project, create a `brief` artifact.
2. Generate a `sow` artifact from agreed scope.
3. `sendSowToClient` opens a `sow_send` policy gate (no silent client email).
4. After human approval (or in parallel for internal work), `buildMVPScaffold` records the MVP scaffold artifact.
5. Agent action logs carry a `correlationId` across the chain.

## Design review (+ Figma)

1. Operator creates a design review with `assetUrl` and/or `figmaUrl`.
2. Figma URLs are validated via `FigmaClient` (mocked in v1); failures log + return actionable errors.
3. Client portal lists reviews, opens asset/Figma links, annotates, approves or rejects.

## Delivery controls

- **Change Request** — impact fields; agency + client decision path.
- **UAT** — checklist items + sign-off (no e-sign vendor).
- **Deposit** — `invoice_or_deposit` gate → Stripe Checkout → webhook updates `Project.depositTotal`.

## Demo runners

- `npm run seed` — sample Clients/Projects/Tasks/artifacts.
- `npm run demo` — exercises lead→onboard and brief→SOW→scaffold in-memory.
