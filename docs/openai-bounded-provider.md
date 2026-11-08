# OpenAI provider: fictional Task to brief

This connects the bounded agent-run path to the requested **GPT-6 Astra** (`gpt-6-astra`) through OpenAI's Responses API. It does not connect general agent chat or enable production. The user supplies the key directly to their own server after pulling the code.

## What is ready, and what is not proved

- A Project Manager calls the single bound `createTask` tool; a tool-free Tech Lead returns a structured internal brief.
- Only the fixed `synthetic-brief-v1` fictional prompt is accepted. Browser requests cannot supply a prompt, model, tenant, actor or API key.
- The existing durable admission permits one run per configured Project. Repeating a run ID inspects its existing outcome and never repeats model execution.
- Two stages have one model step each, zero automatic retries, 1,500 / 3,000 output-token limits, and a 30-second deadline per stage. The requests use low reasoning, standard service tier and `store:false`. These controls are **not a guaranteed dollar spending cap**. A request that times out can still incur provider charges.
- Missing credentials, a different model, production or a custom `OPENAI_BASE_URL` fail closed. Both `gpt-6-astra` and the equivalent Mastra ID `openai/gpt-6-astra` are accepted; the stored model ID is canonicalized to the latter.
- No real account/model request was made during implementation. Account access, billing/credits, live model output and end-to-end replica-set persistence remain separate checks. `store:false` disables provider response storage; it is not a claim of zero data retention.

## Set up the local server

Use Node 22.13+ and npm. Keep this rehearsal on loopback and use fictional data. The existing standalone Mongo example in `.env.example` is not sufficient for this path: **MongoDB must support replica-set transactions**.

If you need a fresh isolated local Mongo replica set and already have Docker, these commands create a new container with no existing database volume. Run them yourself; they are not run automatically by the application:

```sh
docker run -d --name agencyos-openai-mongo -p 127.0.0.1:27028:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec agencyos-openai-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
docker exec agencyos-openai-mongo mongosh --quiet --eval 'db.hello().isWritablePrimary'
```

If Mongo is still starting and the initialization command reports a refused connection, wait briefly and try that initialization command again. Then wait until the last command returns `true`. If the named container already exists, inspect it rather than deleting or overwriting it. An authenticated replica-set deployment may also be used with its appropriate URI, but do not use a production/shared database for the first test.

1. Run `npm ci`. If you have no `.env.local`, copy `.env.example` to it. Do not overwrite an existing file. Set a fresh `AUTH_SECRET` yourself.
2. For the isolated Docker example, set `MONGODB_URI=mongodb://127.0.0.1:27028/agencyos_openai_test?replicaSet=rs0&directConnection=true`, `AUTH_URL=http://localhost:3000`, and `AGENCYOS_ENABLE_DEMO_AUTH=true` in `.env.local`. Leave `AGENCYOS_AGENT_RUN_ENABLED=false` during setup. Demo auth is local development only.
3. Start `npm run dev -- --hostname 127.0.0.1`. Open `http://localhost:3000` and sign in as the existing local operator (`operator@agencyos.local`, password `operator-dev`). Create a fictional Client, then a new Project on that Client's page. Do not bind a GitHub repository. Open its Project page and copy the 24-character Project ID from the URL.
4. Stop the dev server. Add the following configuration to `.env.local`, replacing only the Project placeholder. Enter your real key **yourself** into `OPENAI_API_KEY` in that same file or your server's secret environment. `.env.local` is ignored by Git. Never paste the key into chat, source files, browser code, API request bodies, screenshots or logs; never use a `NEXT_PUBLIC_` variable for it.

```dotenv
AGENCYOS_AGENT_RUN_ENABLED=true
AGENCYOS_AGENT_RUN_TENANT_ID=tenant-default
AGENCYOS_AGENT_RUN_PROJECT_ID=<your-fictional-project-id>
AGENCYOS_AGENT_RUN_MODEL=gpt-6-astra
```

Do not set `OPENAI_BASE_URL`. The key must belong to an OpenAI Platform project with access to the requested model and available billing/credits. This app does not create credentials, configure Platform billing or verify your credit balance. Check these yourself in the Platform dashboard before the first request.

5. Restart the loopback dev server with the same command and sign in again if needed.

For a protected Vercel Preview, use your deployment's server secret manager instead of a checked-in file; the existing `AGENCYOS_AGENT_RUN_PROTECTED_PREVIEW=true` assertion is also required. Verify actual access protection separately. Setting this flag does not create protection. Production remains rejected even when a key exists. No deployment settings were changed by this implementation.

## Run once, then inspect

There is not yet an agent-run dashboard button. The following code is for your authenticated browser's developer console on the local AgencyOS page. It sends no API key. Read it before running it: **the POST starts up to two paid OpenAI requests** against the fixed fictional fixture.

```js
{
const projectId = "<your-fictional-project-id>";
const storageKey = `agencyos:synthetic-brief-v1:${projectId}`;
let runId = localStorage.getItem(storageKey);
if (!runId) {
  runId = crypto.randomUUID();
  localStorage.setItem(storageKey, runId);
}
console.log({ projectId, runId }); // Keep these IDs, never a key or cookie.
const result = await fetch(`/api/projects/${projectId}/agent-runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ runId, fixtureId: "synthetic-brief-v1" }),
});
console.log(result.status, await result.json());
}
```

On success, the returned run has `state:"completed"`, `taskId` and `artifactId`. Inspect the existing Project Task and brief artifact views. After response loss, a timeout, reload or uncertainty, use **GET**, not a replacement run:

```js
{
const projectId = "<your-fictional-project-id>";
const runId = localStorage.getItem(`agencyos:synthetic-brief-v1:${projectId}`);
if (!runId) throw new Error("Recover the original run ID before proceeding");
const result = await fetch(`/api/projects/${projectId}/agent-runs?runId=${encodeURIComponent(runId)}`);
console.log(result.status, await result.json());
}
```

- `401/403`: check your operator sign-in and configured tenant/Project.
- `503` before admission: check the explicit runtime variables, server key, Mongo replica-set connection and readiness. Configuration errors never echo the key.
- `claimed`, `task_created` or `uncertain`: stop and inspect. Do not clear records, change the UUID or start a replacement Project to work around an unknown outcome. A provider error, refusal or timeout is deliberately not retried; preserve the run/audit records and review the account's provider request history.
- `409`: the Project/run is already claimed or its immutable scope conflicts. Inspect the original run.

After the rehearsal, set `AGENCYOS_AGENT_RUN_ENABLED=false` and restart the server to disable both start and inspection endpoints. Do not delete run/audit records to reset a Project.

## Offline checks and sources

Verification on 2026-11-08: `npm run build` passed, including lint, typecheck, 391 tests and production compilation/page generation. All 56 opt-in tests remain skipped. The existing Mastra dynamic-import build warning remains. Independent review found no blocking issue. These results cover this separate provider branch, `feat/openai-bounded-provider`, built from the published V1 candidate without changing its PR.

```sh
npm test -- --run src/lib/agent-runs/openai-bounded-generator.test.ts src/lib/agent-runs/openai-transport.test.ts src/lib/agent-runs/get-agent-run-service.test.ts src/lib/agent-runs/mastra-bounded-generator.test.ts
npm run build
```

The transport tests use synthetic credentials and intercept every HTTP request. They exercise the installed Mastra/OpenAI serializer and response parser, the exact Responses endpoint/model, forced Task-tool invocation, strict brief output, token/options controls, and no retry on 401/404/429/500. They do not establish live API or database success. Existing Mongo tests are opt-in and require an isolated loopback replica set as documented in [bounded-agent verification](bounded-agent-run-verification.md).

Official references checked on 2026-11-08: [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Mastra generate options](https://mastra.ai/reference/agents/generate).
