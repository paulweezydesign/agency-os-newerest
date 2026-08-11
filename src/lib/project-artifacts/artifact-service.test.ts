import { describe, expect, it, vi } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryArtifactRepository } from "./artifact-repository";
import { createArtifactService } from "./artifact-service";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const actionLogs = createInMemoryAgentActionLogRepository();
  const policyRequest = vi.fn(async (input: { correlationId: string }) => ({
    id: "gate-1",
    tenantId: "tenant-a",
    actionType: "sow_send" as const,
    status: "pending" as const,
    payload: {},
    requestedBy: "operator",
    correlationId: input.correlationId,
    effectRan: false,
    createdAt: new Date().toISOString(),
  }));
  const artifacts = createArtifactService(
    createInMemoryArtifactRepository(),
    projects,
    actionLogs,
    { request: policyRequest },
  );
  const client = await clients.create({
    tenantId: "tenant-a",
    name: "Acme",
  });
  const project = await projects.create({
    tenantId: "tenant-a",
    clientId: client.id,
    name: "Website",
    budget: 10000,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-12-01",
  });

  return { artifacts, actionLogs, policyRequest, project };
};

describe("createArtifactService", () => {
  it("persists brief, sow, and mvp_scaffold artifacts", async () => {
    const { artifacts, project, actionLogs } = await setup();

    const brief = await artifacts.createProjectBrief({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "Brief",
      body: "Goals and constraints",
      correlationId: "corr-brief",
      actorName: "agent-operator",
    });
    const sow = await artifacts.generateSOW({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "SOW",
      body: "Scope and milestones",
      correlationId: "corr-sow",
      actorName: "agent-operator",
    });
    const scaffold = await artifacts.buildMVPScaffold({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "MVP",
      body: "Scaffold outline",
      correlationId: "corr-scaffold",
      actorName: "agent-operator",
    });

    const listed = await artifacts.listByProject("tenant-a", project.id);
    expect(listed.map((item) => item.kind).sort()).toEqual([
      "brief",
      "mvp_scaffold",
      "sow",
    ]);
    expect(brief.kind).toBe("brief");
    expect(sow.kind).toBe("sow");
    expect(scaffold.kind).toBe("mvp_scaffold");

    const logs = await actionLogs.listByCorrelationId("tenant-a", "corr-brief");
    expect(logs[0]?.toolName).toBe("createProjectBrief");
  });

  it("queues SOW send through the policy gate without sending immediately", async () => {
    const { artifacts, project, policyRequest, actionLogs } = await setup();
    const sow = await artifacts.generateSOW({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "SOW",
      body: "Scope",
      correlationId: "corr-sow",
      actorName: "agent-operator",
    });

    const result = await artifacts.sendSowToClient({
      tenantId: "tenant-a",
      projectId: project.id,
      artifactId: sow.id,
      correlationId: "corr-send",
      actorName: "agent-operator",
    });

    expect(result).toEqual({ gateId: "gate-1", status: "pending" });
    expect(policyRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "sow_send",
        projectId: project.id,
        payload: expect.objectContaining({ artifactId: sow.id }),
      }),
    );

    const logs = await actionLogs.listByCorrelationId("tenant-a", "corr-send");
    expect(logs[0]).toMatchObject({
      toolName: "sendSowToClient",
      status: "success",
    });
  });

  it("logs actionable errors when SOW send fails", async () => {
    const { artifacts, project, policyRequest, actionLogs } = await setup();
    policyRequest.mockRejectedValueOnce(new Error("Policy gate unavailable"));
    const sow = await artifacts.generateSOW({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "SOW",
      body: "Scope",
      correlationId: "corr-sow-fail",
      actorName: "agent-operator",
    });

    await expect(
      artifacts.sendSowToClient({
        tenantId: "tenant-a",
        projectId: project.id,
        artifactId: sow.id,
        correlationId: "corr-send-fail",
        actorName: "agent-operator",
      }),
    ).rejects.toThrow("Policy gate unavailable");

    const logs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-send-fail",
    );
    expect(logs[0]).toMatchObject({
      toolName: "sendSowToClient",
      status: "error",
      output: { error: "Policy gate unavailable" },
    });
  });
});
