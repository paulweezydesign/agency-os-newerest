import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { connectMongo } from "@/lib/db/mongodb";
import { getProjectService } from "@/lib/projects/get-project-service";
import { createMongooseSpawnedAgentRepository } from "./mongoose-spawned-agent-repository";
import { createSpawnService, type SpawnService } from "./spawn-service";

let cached: SpawnService | null = null;

export const getSpawnService = async (): Promise<SpawnService> => {
  if (cached) {
    return cached;
  }

  await connectMongo();
  const projects = await getProjectService();
  cached = createSpawnService(
    createMongooseSpawnedAgentRepository(),
    projects,
    createMongooseAgentActionLogRepository(),
  );
  return cached;
};
