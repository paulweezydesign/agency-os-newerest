import { RequestContext } from "@mastra/core/request-context";
import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { SPAWN_CAP_PER_PROJECT } from "@/lib/agents/seed-roster";
import { createSpawnService } from "@/lib/agents/spawn-service";
import { createInMemorySpawnedAgentRepository } from "@/lib/agents/spawned-agent-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createProjectManagerSpawnTools } from "./spawn-tools";

const createContext = () => {
  const requestContext = new RequestContext();
  requestContext.set("tenantId", "tenant-a");
  requestContext.set("correlationId", "corr-tool-spawn");
  // Unit tests only need requestContext; cast past Mastra's observe requirement.
  return { requestContext } as never;
};

const createHarness = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const client = await clients.create({
    tenantId: "tenant-a",
    name: "Acme",
  });
  const projectService = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const project = await projectService.create({
    tenantId: "tenant-a",
    clientId: client.id,
    name: "Website rebuild",
    budget: 10_000,
    timelineStart: "2026-01-01",
    timelineEnd: "2026-06-01",
  });
  const actionLogs = createInMemoryAgentActionLogRepository();
  const spawnService = createSpawnService(
    createInMemorySpawnedAgentRepository(),
    projectService,
    actionLogs,
  );
  const tools = createProjectManagerSpawnTools({ spawnService });

  return { project, actionLogs, tools };
};

describe("spawnTeammate tool", () => {
  it("spawns a teammate and records justification in AgentActionLog", async () => {
    const { project, actionLogs, tools } = await createHarness();

    const result = await tools.spawnTeammate.execute!(
      {
        projectId: project.id,
        specialization: "seo",
        justification: "Need SEO audit for launch",
      },
      createContext(),
    );

    expect(result).toMatchObject({
      agent: {
        projectId: project.id,
        specialization: "seo",
        justification: "Need SEO audit for launch",
      },
    });

    const logs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-tool-spawn",
    );
    expect(logs[0]).toMatchObject({
      toolName: "spawnTeammate",
      status: "success",
      input: {
        justification: "Need SEO audit for launch",
      },
    });
  });

  it("returns a structured error when the spawn cap is reached", async () => {
    const { project, tools } = await createHarness();

    for (let index = 0; index < SPAWN_CAP_PER_PROJECT; index += 1) {
      await tools.spawnTeammate.execute!(
        {
          projectId: project.id,
          specialization: `spec-${index}`,
          justification: `Gap ${index}`,
        },
        createContext(),
      );
    }

    const overflow = await tools.spawnTeammate.execute!(
      {
        projectId: project.id,
        specialization: "overflow",
        justification: "Too many",
      },
      createContext(),
    );

    expect(overflow).toMatchObject({
      code: "SPAWN_CAP_EXCEEDED",
      cap: SPAWN_CAP_PER_PROJECT,
    });
  });
});
