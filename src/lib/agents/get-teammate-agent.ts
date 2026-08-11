import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import {
  createTeammateAgent,
  type TeammateAgent,
} from "@/mastra/agents/teammates";
import { isSeedTeammateRole, type SeedTeammateRole } from "./seed-roster";

const cache = new Map<SeedTeammateRole, TeammateAgent>();

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

  const agent = createTeammateAgent(name, {
    actionLogs: createMongooseAgentActionLogRepository(),
  });
  cache.set(name, agent);
  return agent;
};
