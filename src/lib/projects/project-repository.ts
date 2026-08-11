import { randomUUID } from "node:crypto";
import type { Project } from "./schemas";

export type ProjectCreateRecord = {
  tenantId: string;
  clientId: string;
  name: string;
  budget: number;
  timelineStart: string;
  timelineEnd: string;
};

export type ProjectRepository = {
  create: (input: ProjectCreateRecord) => Promise<Project>;
  listByTenantAndClient: (
    tenantId: string,
    clientId: string,
  ) => Promise<Project[]>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<Project | null>;
  updateSpendByTenantAndId: (
    tenantId: string,
    id: string,
    spend: number,
  ) => Promise<Project | null>;
  updateGithubRepoByTenantAndId: (
    tenantId: string,
    id: string,
    githubRepo: string,
  ) => Promise<Project | null>;
};

export const createInMemoryProjectRepository = (): ProjectRepository => {
  const projects: Project[] = [];

  return {
    create: async (input) => {
      const project: Project = {
        id: randomUUID(),
        ...input,
        spend: 0,
        githubRepo: null,
        createdAt: new Date().toISOString(),
      };
      projects.push(project);
      return project;
    },
    listByTenantAndClient: async (tenantId, clientId) =>
      projects.filter(
        (project) =>
          project.tenantId === tenantId && project.clientId === clientId,
      ),
    getByTenantAndId: async (tenantId, id) =>
      projects.find(
        (project) => project.tenantId === tenantId && project.id === id,
      ) ?? null,
    updateSpendByTenantAndId: async (tenantId, id, spend) => {
      const project = projects.find(
        (entry) => entry.tenantId === tenantId && entry.id === id,
      );

      if (!project) {
        return null;
      }

      project.spend = spend;
      return project;
    },
    updateGithubRepoByTenantAndId: async (tenantId, id, githubRepo) => {
      const project = projects.find(
        (entry) => entry.tenantId === tenantId && entry.id === id,
      );

      if (!project) {
        return null;
      }

      project.githubRepo = githubRepo;
      return project;
    },
  };
};
