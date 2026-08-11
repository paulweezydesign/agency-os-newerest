import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { PolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import type { ArtifactRepository } from "./artifact-repository";
import {
  createArtifactInputSchema,
  sendSowInputSchema,
  type ArtifactKind,
  type ProjectArtifact,
} from "./schemas";
import { requestSowSendGate } from "./send-sow";

export class ArtifactNotFoundError extends Error {
  constructor(message = "Artifact not found for tenant") {
    super(message);
    this.name = "ArtifactNotFoundError";
  }
}

export class ArtifactKindError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactKindError";
  }
}

export type ArtifactService = {
  createProjectBrief: (input: {
    tenantId: string;
    projectId: string;
    title: string;
    body: string;
    correlationId: string;
    actorName: string;
  }) => Promise<ProjectArtifact>;
  generateSOW: (input: {
    tenantId: string;
    projectId: string;
    title: string;
    body: string;
    correlationId: string;
    actorName: string;
  }) => Promise<ProjectArtifact>;
  buildMVPScaffold: (input: {
    tenantId: string;
    projectId: string;
    title: string;
    body: string;
    correlationId: string;
    actorName: string;
  }) => Promise<ProjectArtifact>;
  listByProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<ProjectArtifact[]>;
  sendSowToClient: (input: {
    tenantId: string;
    projectId: string;
    artifactId: string;
    correlationId: string;
    actorName: string;
  }) => Promise<{ gateId: string; status: "pending" }>;
};

const createArtifactOfKind =
  (
    repository: ArtifactRepository,
    projects: Pick<ProjectService, "get">,
    actionLogs: AgentActionLogRepository,
    kind: ArtifactKind,
    toolName: string,
  ) =>
  async (input: {
    tenantId: string;
    projectId: string;
    title: string;
    body: string;
    correlationId: string;
    actorName: string;
  }) => {
    const parsed = createArtifactInputSchema.parse({
      title: input.title,
      body: input.body,
    });
    const project = await projects.get(input.tenantId, input.projectId);

    if (!project) {
      throw new ProjectNotFoundError();
    }

    try {
      const artifact = await repository.create({
        tenantId: input.tenantId,
        projectId: input.projectId,
        kind,
        title: parsed.title,
        body: parsed.body,
      });

      await actionLogs.append({
        tenantId: input.tenantId,
        agentName: input.actorName,
        toolName,
        input: {
          projectId: input.projectId,
          title: parsed.title,
          kind,
        },
        output: { artifact },
        status: "success",
        correlationId: input.correlationId,
        projectId: input.projectId,
      });

      return artifact;
    } catch (error) {
      await actionLogs.append({
        tenantId: input.tenantId,
        agentName: input.actorName,
        toolName,
        input: { projectId: input.projectId, kind },
        output: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        status: "error",
        correlationId: input.correlationId,
        projectId: input.projectId,
      });
      throw error;
    }
  };

export const createArtifactService = (
  repository: ArtifactRepository,
  projects: Pick<ProjectService, "get">,
  actionLogs: AgentActionLogRepository,
  policyGates: Pick<PolicyGateService, "request">,
): ArtifactService => ({
  createProjectBrief: createArtifactOfKind(
    repository,
    projects,
    actionLogs,
    "brief",
    "createProjectBrief",
  ),
  generateSOW: createArtifactOfKind(
    repository,
    projects,
    actionLogs,
    "sow",
    "generateSOW",
  ),
  buildMVPScaffold: createArtifactOfKind(
    repository,
    projects,
    actionLogs,
    "mvp_scaffold",
    "buildMVPScaffold",
  ),
  listByProject: (tenantId, projectId) =>
    repository.listByTenantAndProject(tenantId, projectId),
  sendSowToClient: async ({
    tenantId,
    projectId,
    artifactId,
    correlationId,
    actorName,
  }) => {
    const parsed = sendSowInputSchema.parse({ artifactId });
    const project = await projects.get(tenantId, projectId);

    if (!project) {
      throw new ProjectNotFoundError();
    }

    const artifact = await repository.getByTenantAndId(
      tenantId,
      parsed.artifactId,
    );

    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError();
    }

    if (artifact.kind !== "sow") {
      throw new ArtifactKindError("Only SOW artifacts can be sent to a Client");
    }

    try {
      const gate = await requestSowSendGate({
        policyGates,
        tenantId,
        projectId,
        artifactId: artifact.id,
        title: artifact.title,
        requestedBy: actorName,
        correlationId,
      });

      await actionLogs.append({
        tenantId,
        agentName: actorName,
        toolName: "sendSowToClient",
        input: { projectId, artifactId: artifact.id },
        output: { gateId: gate.id, status: gate.status },
        status: "success",
        correlationId,
        projectId,
      });

      return { gateId: gate.id, status: "pending" as const };
    } catch (error) {
      await actionLogs.append({
        tenantId,
        agentName: actorName,
        toolName: "sendSowToClient",
        input: { projectId, artifactId: parsed.artifactId },
        output: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        status: "error",
        correlationId,
        projectId,
      });
      throw error;
    }
  },
});
