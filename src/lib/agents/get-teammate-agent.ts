import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { getExaClient } from "@/lib/exa/get-exa-client";
import { getKnowledgeBase } from "@/lib/rag/get-knowledge-base";
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
  const agent = createTeammateAgent(name, {
    actionLogs,
    research:
      name === "research"
        ? {
            exa: getExaClient(),
            knowledgeBase: getKnowledgeBase(),
          }
        : undefined,
  });
  cache.set(name, agent);
  return agent;
};
