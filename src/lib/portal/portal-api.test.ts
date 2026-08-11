import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { SEED_CLIENT_ID } from "@/lib/auth/seed-users";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryArtifactRepository } from "@/lib/project-artifacts/artifact-repository";
import { createArtifactService } from "@/lib/project-artifacts/artifact-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import {
  handleGetPortalProject,
  handleListPortalProjects,
} from "./portal-api";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const artifacts = createArtifactService(
    createInMemoryArtifactRepository(),
    projects,
    createInMemoryAgentActionLogRepository(),
    {
      request: async () => {
        throw new Error("not used");
      },
    },
  );

  await clients.create({
    tenantId: "tenant-default",
    id: SEED_CLIENT_ID,
    name: "Acme Co",
  });

  const project = await projects.create({
    tenantId: "tenant-default",
    clientId: SEED_CLIENT_ID,
    name: "Portal Project",
    budget: 1000,
    timelineStart: "2026-01-01",
    timelineEnd: "2026-02-01",
  });

  await artifacts.createProjectBrief({
    tenantId: "tenant-default",
    projectId: project.id,
    title: "Brief",
    body: "Scope",
    correlationId: "c1",
    actorName: "operator",
  });

  return { clients, projects, artifacts, project };
};

describe("portal-api", () => {
  it("lists projects for the seed client user", async () => {
    const { clients, projects } = await setup();

    const result = await handleListPortalProjects({
      session: {
        user: {
          id: "user-client",
          role: "client",
          tenantId: "tenant-default",
        },
      },
      clients,
      projects,
    });

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body).toHaveLength(1);
      expect(result.body[0]?.name).toBe("Portal Project");
    }
  });

  it("denies operators from portal APIs", async () => {
    const { clients, projects } = await setup();

    const result = await handleListPortalProjects({
      session: {
        user: {
          id: "user-operator",
          role: "agent-operator",
          tenantId: "tenant-default",
        },
      },
      clients,
      projects,
    });

    expect(result.status).toBe(403);
  });

  it("returns project status and artifacts for the owning client", async () => {
    const { clients, projects, artifacts, project } = await setup();

    const result = await handleGetPortalProject({
      session: {
        user: {
          id: "user-client",
          role: "client",
          tenantId: "tenant-default",
        },
      },
      clients,
      projects,
      artifacts,
      projectId: project.id,
    });

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.project.id).toBe(project.id);
      expect(result.body.artifacts).toHaveLength(1);
      expect(result.body.artifacts[0]?.kind).toBe("brief");
    }
  });

  it("hides other clients' projects", async () => {
    const { clients, projects, artifacts } = await setup();
    const other = await clients.create({
      tenantId: "tenant-default",
      name: "Other",
    });
    const otherProject = await projects.create({
      tenantId: "tenant-default",
      clientId: other.id,
      name: "Secret",
      budget: 10,
      timelineStart: "2026-01-01",
      timelineEnd: "2026-01-02",
    });

    const result = await handleGetPortalProject({
      session: {
        user: {
          id: "user-client",
          role: "client",
          tenantId: "tenant-default",
        },
      },
      clients,
      projects,
      artifacts,
      projectId: otherProject.id,
    });

    expect(result.status).toBe(404);
  });
});
