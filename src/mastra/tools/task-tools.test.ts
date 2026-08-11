import { describe, expect, it } from "vitest";
import { RequestContext } from "@mastra/core/request-context";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import {
  PROJECT_MANAGER_AGENT_NAME,
  createCreateTaskTool,
  createListTasksTool,
  createTaskToolInputSchema,
  listTasksInputSchema,
} from "./task-tools";

const createDeps = async () => {
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
  const client = await clients.create({
    tenantId: "tenant-default",
    name: "Acme Co",
  });
  const project = await projects.create({
    tenantId: "tenant-default",
    clientId: client.id,
    name: "Website redesign",
    budget: 10000,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-12-01",
  });

  return { taskService, actionLogs, project };
};

const withContext = (tenantId: string, correlationId: string) => {
  const requestContext = new RequestContext();
  requestContext.set("tenantId", tenantId);
  requestContext.set("correlationId", correlationId);
  // Unit tests only need requestContext; cast past Mastra's observe requirement.
  return { requestContext } as never;
};

describe("project-manager task tool schemas", () => {
  it("rejects invalid listTasks and createTask input", () => {
    expect(() => listTasksInputSchema.parse({})).toThrow();
    expect(() => listTasksInputSchema.parse({ projectId: "" })).toThrow();
    expect(() =>
      createTaskToolInputSchema.parse({ projectId: "p1", title: "  " }),
    ).toThrow();
  });

  it("accepts valid createTask input", () => {
    expect(
      createTaskToolInputSchema.parse({
        projectId: "p1",
        title: "Draft brief",
        description: "Scope",
      }),
    ).toEqual({
      projectId: "p1",
      title: "Draft brief",
      description: "Scope",
    });
  });
});

describe("project-manager task tools", () => {
  it("lists tasks and logs AgentActionLog with correlationId", async () => {
    const { taskService, actionLogs, project } = await createDeps();
    await taskService.create({
      tenantId: "tenant-default",
      projectId: project.id,
      title: "Existing task",
      correlationId: "seed-corr",
      actorName: "agent-operator",
    });

    const listTasks = createListTasksTool({ taskService, actionLogs });
    const result = await listTasks.execute!(
      { projectId: project.id },
      withContext("tenant-default", "corr-list-1"),
    );

    expect(result).toMatchObject({
      tasks: [{ title: "Existing task", projectId: project.id }],
    });

    const logs = await actionLogs.listByCorrelationId(
      "tenant-default",
      "corr-list-1",
    );
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentName: PROJECT_MANAGER_AGENT_NAME,
          toolName: "listTasks",
          status: "success",
          correlationId: "corr-list-1",
          projectId: project.id,
        }),
      ]),
    );
  });

  it("creates a task via TaskService and logs AgentActionLog", async () => {
    const { taskService, actionLogs, project } = await createDeps();
    const createTask = createCreateTaskTool({ taskService, actionLogs });

    const result = await createTask.execute!(
      {
        projectId: project.id,
        title: "Write research brief",
        description: "Competitor scan",
      },
      withContext("tenant-default", "corr-create-1"),
    );

    expect(result).toMatchObject({
      task: {
        title: "Write research brief",
        description: "Competitor scan",
        status: "todo",
        projectId: project.id,
      },
    });

    const listed = await taskService.listByProject(
      "tenant-default",
      project.id,
    );
    expect(listed).toHaveLength(1);

    const logs = await actionLogs.listByCorrelationId(
      "tenant-default",
      "corr-create-1",
    );
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentName: PROJECT_MANAGER_AGENT_NAME,
          toolName: "createTask",
          status: "success",
          correlationId: "corr-create-1",
          projectId: project.id,
        }),
      ]),
    );
  });
});
