import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { createSpawnedTeammateAgent } from "@/mastra/agents/teammates";
import { getSpawnService } from "./get-spawn-service";

export const getSpawnedTeammateAgent = async (
  tenantId: string,
  agentId: string,
) => {
  if (!agentId.startsWith("spawned:")) {
    return null;
  }

  const spawnService = await getSpawnService();
  const record = await spawnService.getByTenantAndId(tenantId, agentId);
  if (!record) {
    return null;
  }

  return createSpawnedTeammateAgent(
    {
      id: record.id,
      specialization: record.specialization,
      justification: record.justification,
    },
    {
      actionLogs: createMongooseAgentActionLogRepository(),
    },
  );
};
