import { z } from "zod";
import type { AuthSession } from "@/lib/auth/session-context";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import { getAgentRunRepository, getAgentRunService } from "./get-agent-run-service";
import { resolveAgentRunConfig } from "./runtime-policy";
import { AgentRunConflict, AgentRunUnavailable, startRunSchema, type AgentRun, type RunIdentity } from "./schemas";
import type { AgentRunService } from "./agent-run-service";

type Deps = {
  env?: NodeJS.ProcessEnv;
  inspect?: (identity: RunIdentity) => Promise<AgentRun | null>;
  start?: AgentRunService["start"];
};
export const handleAgentRunRequest = async ({
  session, projectId, method, body, deps = {},
}: {
  session: AuthSession; projectId: string; method: "GET" | "POST"; body: unknown; deps?: Deps;
}) => {
  const access = resolveOperatorApiAccess(session);
  if (access.status !== "allow") return { status: access.status === "unauthenticated" ? 401 : 403, body: { error: "Unauthorized" } };
  try {
    const config = resolveAgentRunConfig(deps.env);
    if (config.tenantId !== access.context.tenantId || config.projectId !== projectId) {
      return { status: 403, body: { error: "Project is outside the configured synthetic scope" } };
    }
    const parsed = (method === "POST" ? startRunSchema : z.object({ runId: z.uuid() }).strict()).safeParse(body);
    if (!parsed.success) return { status: 400, body: { error: "Invalid request" } };
    const identity = { tenantId: access.context.tenantId, projectId, runId: parsed.data.runId };
    const run = method === "GET"
      ? await (deps.inspect ?? (async id => (await getAgentRunRepository()).inspect(id)))(identity)
      : await (deps.start ?? (async input => (await getAgentRunService()).start(input)))({
        ...identity, actorId: access.context.userId, fixtureId: startRunSchema.parse(body).fixtureId,
      });
    return run ? { status: 200, body: { run } } : { status: 404, body: { error: "Run not found" } };
  } catch (error) {
    if (error instanceof AgentRunUnavailable) return { status: 503, body: { error: error.message } };
    if (error instanceof AgentRunConflict) return { status: 409, body: { error: "Run requires inspection or reconciliation" } };
    return { status: 503, body: { error: "Run unavailable; inspect existing state before retrying" } };
  }
};
