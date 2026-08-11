import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { SPAWN_CAP_PER_PROJECT } from "./seed-roster";
import { createSpawnService } from "./spawn-service";
import { createInMemorySpawnedAgentRepository } from "./spawned-agent-repository";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const actionLogs = createInMemoryAgentActionLogRepository();
  const spawn = createSpawnService(
    createInMemorySpawnedAgentRepository(),
    projects,
    actionLogs,
  );
  const client = await clients.create({
    tenantId: "tenant-a",
    name: "Acme",
  });
  const project = await projects.create({
    tenantId: "tenant-a",
    clientId: client.id,
    name: "Site",
    budget: 1,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-10-01",
  });
  return { spawn, actionLogs, project };
};

describe("createSpawnService", () => {
  it("spawns a dynamic teammate with logged justification", async () => {
    const { spawn, actionLogs, project } = await setup();

    const agent = await spawn.spawn({
      tenantId: "tenant-a",
      projectId: project.id,
      specialization: "performance-engineer",
      justification: "Need Lighthouse budget work",
      createdBy: "project-manager",
      correlationId: "corr-spawn",
    });

    expect(agent.specialization).toBe("performance-engineer");
    expect(agent.justification).toBe("Need Lighthouse budget work");
    const logs = await actionLogs.listByCorrelationId("tenant-a", "corr-spawn");
    expect(logs[0]).toMatchObject({
      toolName: "spawnTeammate",
      status: "success",
    });
  });

  it("enforces the spawn cap of 10 per project", async () => {
    const { spawn, project } = await setup();

    for (let i = 0; i < SPAWN_CAP_PER_PROJECT; i += 1) {
      await spawn.spawn({
        tenantId: "tenant-a",
        projectId: project.id,
        specialization: `spec-${i}`,
        justification: `reason-${i}`,
        createdBy: "project-manager",
        correlationId: `corr-${i}`,
      });
    }

    await expect(
      spawn.spawn({
        tenantId: "tenant-a",
        projectId: project.id,
        specialization: "one-more",
        justification: "overflow",
        createdBy: "project-manager",
        correlationId: "corr-overflow",
      }),
    ).rejects.toThrow(/cap of 10/i);

    expect(await spawn.countByProject("tenant-a", project.id)).toBe(10);
  });
});
