import { randomUUID } from "node:crypto";

export type SpawnedAgent = {
  id: string;
  tenantId: string;
  projectId: string;
  specialization: string;
  justification: string;
  createdBy: string;
  createdAt: string;
};

export type SpawnedAgentCreateRecord = {
  tenantId: string;
  projectId: string;
  specialization: string;
  justification: string;
  createdBy: string;
};

export type SpawnedAgentRepository = {
  create: (input: SpawnedAgentCreateRecord) => Promise<SpawnedAgent>;
  listByTenantAndProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<SpawnedAgent[]>;
  countByTenantAndProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<number>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<SpawnedAgent | null>;
};

export const createInMemorySpawnedAgentRepository =
  (): SpawnedAgentRepository => {
    const agents: SpawnedAgent[] = [];

    return {
      create: async (input) => {
        const agent: SpawnedAgent = {
          id: `spawned:${randomUUID()}`,
          ...input,
          createdAt: new Date().toISOString(),
        };
        agents.push(agent);
        return agent;
      },
      listByTenantAndProject: async (tenantId, projectId) =>
        agents.filter(
          (agent) =>
            agent.tenantId === tenantId && agent.projectId === projectId,
        ),
      countByTenantAndProject: async (tenantId, projectId) =>
        agents.filter(
          (agent) =>
            agent.tenantId === tenantId && agent.projectId === projectId,
        ).length,
      getByTenantAndId: async (tenantId, id) =>
        agents.find(
          (agent) => agent.tenantId === tenantId && agent.id === id,
        ) ?? null,
    };
  };
