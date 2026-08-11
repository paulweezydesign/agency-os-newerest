import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { getClientPipelineService } from "@/lib/client-pipeline/get-client-pipeline-service";
import {
  createTeammateAgent,
  type TeammateAgent,
} from "@/mastra/agents/teammates";
import { isSeedTeammateRole, type SeedTeammateRole } from "./seed-roster";

const cache = new Map<SeedTeammateRole, TeammateAgent>();

const PIPELINE_ROLES = new Set(["prospector", "nurture", "onboarding"]);

export const getTeammateAgent = async (
  name: string,
): Promise<TeammateAgent | null> => {
  if (!isSeedTeammateRole(name)) {
    return null;
  }

  const cached = cache.get(name);
  if (cached) {
    return cached;
  }

  const actionLogs = createMongooseAgentActionLogRepository();
  const pipeline = PIPELINE_ROLES.has(name)
    ? await getClientPipelineService()
    : undefined;

  const agent = createTeammateAgent(name, {
    actionLogs,
    pipeline,
  });
  cache.set(name, agent);
  return agent;
};
