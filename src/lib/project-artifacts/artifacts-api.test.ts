import { describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryArtifactRepository } from "./artifact-repository";
import { createArtifactService } from "./artifact-service";
import {
  handleCreateArtifact,
  handleListArtifacts,
  handleSendSow,
} from "./artifacts-api";

const operatorSession: AuthSession = {
  user: {
    id: "user-1",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const policyRequest = vi.fn(async (input: { correlationId: string }) => ({
    id: "gate-api",
    tenantId: "tenant-default",
    actionType: "sow_send" as const,
    status: "pending" as const,
    payload: {},
    requestedBy: "agent-operator",
    correlationId: input.correlationId,
    effectRan: false,
    createdAt: new Date().toISOString(),
  }));
  const service = createArtifactService(
    createInMemoryArtifactRepository(),
    projects,
    createInMemoryAgentActionLogRepository(),
    { request: policyRequest },
  );
  const client = await clients.create({
    tenantId: "tenant-default",
    name: "Acme",
  });
  const project = await projects.create({
    tenantId: "tenant-default",
    clientId: client.id,
    name: "Site",
    budget: 1,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-10-01",
  });
  return { service, project, policyRequest };
};

describe("artifacts-api", () => {
  it("creates and lists artifacts, and gates SOW send", async () => {
    const { service, project, policyRequest } = await setup();

    const created = await handleCreateArtifact({
      session: operatorSession,
      service,
      projectId: project.id,
      kind: "sow",
      body: { title: "SOW", body: "Scope" },
    });
    expect(created.status).toBe(201);

    const listed = await handleListArtifacts({
      session: operatorSession,
      service,
      projectId: project.id,
    });
    expect(listed.status).toBe(200);
    if (listed.status !== 200 || created.status !== 201) {
      return;
    }
    expect(listed.body).toHaveLength(1);

    const sent = await handleSendSow({
      session: operatorSession,
      service,
      projectId: project.id,
      body: { artifactId: created.body.id },
    });
    expect(sent).toEqual({
      status: 200,
      body: { gateId: "gate-api", status: "pending" },
    });
    expect(policyRequest).toHaveBeenCalled();
  });

  it("rejects unauthenticated list", async () => {
    const { service, project } = await setup();
    const result = await handleListArtifacts({
      session: null,
      service,
      projectId: project.id,
    });
    expect(result.status).toBe(401);
  });
});
