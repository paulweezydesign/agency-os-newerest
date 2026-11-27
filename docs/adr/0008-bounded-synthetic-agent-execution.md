# Bounded synthetic agent execution

Status: implemented behind a disabled runtime boundary; live provider acceptance is pending.

## Decision

Add a separate synthetic agent-run path rather than expanding the general agent chat. One Project Manager (agent) invokes a server-bound `createTask` tool. One Tech Lead teammate, with no tools, produces a structured internal brief. Persist the Task and brief in the existing MongoDB system of record, linked by an additive AgentRun record. Retain the existing deterministic lead workflow unchanged.

The request accepts a fixed versioned fictional fixture and a UUID. Tenant, Project, actor, model and permitted capabilities are server-owned. The runtime defaults off, rejects Production, and requires explicit synthetic scope. Preview requires an explicit protected-environment assertion; configuration is not evidence that deployment protection was independently verified.

## Persistence and uncertainty

Unique tenant/run and tenant/Project indexes admit at most one run for a Project. Admission commits before any model call. A resumed HTTP request inspects the existing run; it does not invoke the model again.

Mongo transactions bind Task creation to its audit/checkpoint, and bind artifact creation to Task completion and its audit/checkpoint. A replica set is required. Do not fall back to separate Task/artifact/audit writes if transactions are unavailable. Do not put model calls inside transaction callbacks or automatically replay them after a crash.

An uncertain run remains inspectable and blocked. There is no expiring lease, reset route, automatic retry, or record deletion to restart work. A possibly committed completion is authoritative only after reading the stored run.

## Capability boundary

Do not compose this feature with the existing general agent getters. Those can initialize GitHub, spawning, Monday synchronization, Slack, Exa or other capabilities. The new path uses only its dedicated persistence repository and bounded model factories. The Project Manager cannot write the deliverable itself; the teammate cannot contact anyone or execute code.

Model adapters are injected and provider-neutral. An existing ChatGPT plan or model name does not by itself establish that a hosted application can call it.

The approved OpenAI follow-up (2026-11-08) supplies the server adapter for exactly `gpt-6-astra`, with the runtime still default-off. It reads only an explicitly configured server `OPENAI_API_KEY`, rejects custom endpoints, and has no sign-in flow, model fallback or credential persistence. The Responses request uses low reasoning, standard service tier, bounded output, `store:false` and zero retries. Account entitlement and live execution remain acceptance gates. See [provider setup](../openai-bounded-provider.md).

## Consequences

- The first slice can be tested offline without provider access or external effects.
- The actual live-model proof, transaction/restart proof and protected Preview proof remain separate acceptance gates.
- The added record links existing Task and ProjectArtifact documents without migrating them.
- Safe uncertainty can leave unfinished Tasks requiring human inspection. Availability is deliberately secondary to avoiding duplicate execution or false completion.
- One agent run per fictional Project is a deliberate first-slice constraint, not a general-purpose agent scheduler.
