import { z } from "zod";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import { SPAWN_CAP_PER_PROJECT } from "./seed-roster";
import type {
  SpawnedAgent,
  SpawnedAgentRepository,
} from "./spawned-agent-repository";

export class SpawnCapExceededError extends Error {
  constructor(
    message = `Spawn cap of ${SPAWN_CAP_PER_PROJECT} dynamic teammates per Project exceeded`,
  ) {
    super(message);
    this.name = "SpawnCapExceededError";
  }
}

export const spawnTeammateInputSchema = z.object({
  projectId: z.string().min(1),
  specialization: z.string().trim().min(1, "specialization is required"),
  justification: z.string().trim().min(1, "justification is required"),
});

export type SpawnService = {
  spawn: (input: {
    tenantId: string;
    projectId: string;
    specialization: string;
    justification: string;
    createdBy: string;
    correlationId: string;
  }) => Promise<SpawnedAgent>;
  listByProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<SpawnedAgent[]>;
  countByProject: (tenantId: string, projectId: string) => Promise<number>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<SpawnedAgent | null>;
};

export const createSpawnService = (
  repository: SpawnedAgentRepository,
  projects: Pick<ProjectService, "get">,
  actionLogs: AgentActionLogRepository,
): SpawnService => ({
  spawn: async ({
    tenantId,
    projectId,
    specialization,
    justification,
    createdBy,
    correlationId,
  }) => {
    const parsed = spawnTeammateInputSchema.parse({
      projectId,
      specialization,
      justification,
    });
    const project = await projects.get(tenantId, parsed.projectId);

    if (!project) {
      throw new ProjectNotFoundError();
    }

    const count = await repository.countByTenantAndProject(
      tenantId,
      parsed.projectId,
    );

    if (count >= SPAWN_CAP_PER_PROJECT) {
      await actionLogs.append({
        tenantId,
        agentName: createdBy,
        toolName: "spawnTeammate",
        input: parsed,
        output: { error: `Spawn cap ${SPAWN_CAP_PER_PROJECT} reached` },
        status: "error",
        correlationId,
        projectId: parsed.projectId,
      });
      throw new SpawnCapExceededError();
    }

    const agent = await repository.create({
      tenantId,
      projectId: parsed.projectId,
      specialization: parsed.specialization,
      justification: parsed.justification,
      createdBy,
    });

    await actionLogs.append({
      tenantId,
      agentName: createdBy,
      toolName: "spawnTeammate",
      input: parsed,
      output: { agent },
      status: "success",
      correlationId,
      projectId: parsed.projectId,
    });

    return agent;
  },
  listByProject: (tenantId, projectId) =>
    repository.listByTenantAndProject(tenantId, projectId),
  countByProject: (tenantId, projectId) =>
    repository.countByTenantAndProject(tenantId, projectId),
  getByTenantAndId: (tenantId, id) =>
    repository.getByTenantAndId(tenantId, id),
});
