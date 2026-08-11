import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import {
  PROJECT_MANAGER_INSTRUCTIONS,
  createProjectManagerAgent,
} from "./project-manager";

describe("project-manager agent", () => {
  it("instructions enforce orchestrate-only (no deliverable execution)", () => {
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(/orchestrat/i);
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(/does not complete deliverable work/i);
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(/listTasks|createTask/);
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(/tools only|through tools/i);
  });

  it("exposes listTasks and createTask tools only", async () => {
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

    const agent = createProjectManagerAgent({ taskService, actionLogs });
    const tools = await agent.listTools();
    const instructions = await agent.getInstructions();

    expect(agent.id).toBe("project-manager");
    expect(instructions).toContain("does not complete deliverable work");
    expect(Object.keys(tools).sort()).toEqual(["createTask", "listTasks"]);
  });
});
