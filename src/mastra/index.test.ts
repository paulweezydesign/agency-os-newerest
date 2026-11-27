import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { SEED_TEAMMATE_ROLES } from "@/lib/agents/seed-roster";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryGitHubClient } from "@/lib/github/github-client";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import { createMastraApp, mastra } from "./index";

describe("createMastraApp", () => {
  it("registers the bounded workflow without requiring credentials or agent dependencies", () => {
    const app = createMastraApp();

    expect(app).toBeDefined();
    expect(app.listAgents()).toEqual({});
    expect(app.listTools()).toEqual({});
    expect(Object.keys(app.listWorkflows())).toEqual(["clientPipeline"]);
    expect(app.getWorkflow("clientPipeline").id).toBe("client-pipeline");

    expect(mastra).toBeDefined();
    expect(mastra.listAgents()).toEqual({});
    expect(mastra.getWorkflow("clientPipeline").id).toBe("client-pipeline");
  });

  it("registers PM, seed teammates, and tools when deps are provided", () => {
    const clients = createClientService(createInMemoryClientRepository());
    const projectService = createProjectService(
      createInMemoryProjectRepository(),
      clients,
      createInMemoryBudgetAlertRepository(),
    );
    const actionLogs = createInMemoryAgentActionLogRepository();
    const taskService = createTaskService(
      createInMemoryTaskRepository(),
      projectService,
      actionLogs,
    );

    const app = createMastraApp({
      projectManagerDeps: {
        taskService,
        actionLogs,
        projectService,
        github: createInMemoryGitHubClient(),
      },
    });

    const agents = app.listAgents();
    expect(app.getWorkflow("clientPipeline").id).toBe("client-pipeline");
    const agentIds = Object.values(agents).map((agent) => agent.id).sort();
    expect(agentIds).toEqual(
      ["project-manager", ...SEED_TEAMMATE_ROLES].sort(),
    );
    expect(agents.projectManager.id).toBe("project-manager");

    const tools = app.listTools() ?? {};
    expect(Object.keys(tools).sort()).toEqual([
      "createTask",
      "listTasks",
      "openPullRequestFromTask",
      "reportStatus",
    ]);
  });
});
