import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import { createMastraApp, mastra } from "./index";

describe("createMastraApp", () => {
  it("exports a Mastra stub with empty registries by default", () => {
    const app = createMastraApp();

    expect(app).toBeDefined();
    expect(app.listAgents()).toEqual({});
    expect(app.listTools()).toEqual({});
    expect(app.listWorkflows()).toEqual({});

    expect(mastra).toBeDefined();
    expect(mastra.listAgents()).toEqual({});
  });

  it("registers the project-manager agent and task tools when deps are provided", () => {
    const clients = createClientService(createInMemoryClientRepository());
    const projects = createProjectService(
      createInMemoryProjectRepository(),
      clients,
      createInMemoryBudgetAlertRepository(),
    );
    const actionLogs = createInMemoryAgentActionLogRepository();
    const taskService = createTaskService(
      createInMemoryTaskRepository(),
      projects,
      actionLogs,
    );

    const app = createMastraApp({
      projectManagerDeps: { taskService, actionLogs },
    });

    const agents = app.listAgents();
    expect(Object.keys(agents)).toEqual(["projectManager"]);
    expect(agents.projectManager.id).toBe("project-manager");

    const tools = app.listTools() ?? {};
    expect(Object.keys(tools).sort()).toEqual(["createTask", "listTasks"]);
  });
});
