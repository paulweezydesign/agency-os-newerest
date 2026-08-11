import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { connectMongo } from "@/lib/db/mongodb";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import { getProjectService } from "@/lib/projects/get-project-service";
import { createArtifactService, type ArtifactService } from "./artifact-service";
import { createMongooseArtifactRepository } from "./mongoose-artifact-repository";

let cached: ArtifactService | null = null;

export const getArtifactService = async (): Promise<ArtifactService> => {
  if (cached) {
    return cached;
  }

  await connectMongo();
  const projects = await getProjectService();
  const policyGates = await getPolicyGateService();
  cached = createArtifactService(
    createMongooseArtifactRepository(),
    projects,
    createMongooseAgentActionLogRepository(),
    policyGates,
  );
  return cached;
};
