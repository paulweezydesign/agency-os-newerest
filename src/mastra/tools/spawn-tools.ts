import { createTool } from "@mastra/core/tools";
import type { ToolExecutionContext } from "@mastra/core/tools";
import {
  SpawnCapExceededError,
  spawnTeammateInputSchema,
  type SpawnService,
} from "@/lib/agents/spawn-service";
import { SPAWN_CAP_PER_PROJECT } from "@/lib/agents/seed-roster";
import { PROJECT_MANAGER_AGENT_NAME } from "./task-tools";

export type SpawnToolDeps = {
  spawnService: SpawnService;
};

const readRequestFields = (context?: ToolExecutionContext) => {
  const requestContext = context?.requestContext;
  const tenantId = requestContext?.get("tenantId");
  const correlationId = requestContext?.get("correlationId");

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("requestContext.tenantId is required");
  }
  if (typeof correlationId !== "string" || correlationId.length === 0) {
    throw new Error("requestContext.correlationId is required");
  }
  return { tenantId, correlationId };
};

export const createSpawnTeammateTool = ({ spawnService }: SpawnToolDeps) =>
  createTool({
    id: "spawnTeammate",
    description:
      "Spawn a specialized teammate beyond the seed roster for a Project. Cap is 10 dynamic agents per Project. Justification is required and logged.",
    inputSchema: spawnTeammateInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);

      try {
        const agent = await spawnService.spawn({
          tenantId,
          projectId: input.projectId,
          specialization: input.specialization,
          justification: input.justification,
          createdBy: PROJECT_MANAGER_AGENT_NAME,
          correlationId,
        });
        return { agent };
      } catch (error) {
        if (error instanceof SpawnCapExceededError) {
          return {
            code: "SPAWN_CAP_EXCEEDED" as const,
            cap: SPAWN_CAP_PER_PROJECT,
            message: error.message,
          };
        }
        throw error;
      }
    },
  });

export const createProjectManagerSpawnTools = (deps: SpawnToolDeps) => ({
  spawnTeammate: createSpawnTeammateTool(deps),
});
