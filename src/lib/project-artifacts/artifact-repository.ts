import { randomUUID } from "node:crypto";
import type { ArtifactKind, ProjectArtifact } from "./schemas";

export type ArtifactCreateRecord = {
  tenantId: string;
  projectId: string;
  kind: ArtifactKind;
  title: string;
  body: string;
};

export type ArtifactRepository = {
  create: (input: ArtifactCreateRecord) => Promise<ProjectArtifact>;
  listByTenantAndProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<ProjectArtifact[]>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<ProjectArtifact | null>;
};

export const createInMemoryArtifactRepository = (): ArtifactRepository => {
  const artifacts: ProjectArtifact[] = [];

  return {
    create: async (input) => {
      const artifact: ProjectArtifact = {
        id: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      };
      artifacts.push(artifact);
      return artifact;
    },
    listByTenantAndProject: async (tenantId, projectId) =>
      artifacts
        .filter(
          (artifact) =>
            artifact.tenantId === tenantId && artifact.projectId === projectId,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    getByTenantAndId: async (tenantId, id) =>
      artifacts.find(
        (artifact) => artifact.tenantId === tenantId && artifact.id === id,
      ) ?? null,
  };
};
