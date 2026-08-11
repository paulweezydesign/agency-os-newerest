import { describe, expect, it } from "vitest";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryTaskRepository } from "./task-repository";
import { createTaskService } from "./task-service";

const createStack = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const actionLogs = createInMemoryAgentActionLogRepository();
  const tasks = createTaskService(
    createInMemoryTaskRepository(),
    projects,
    actionLogs,
  );

  const client = await clients.create({
    tenantId: "tenant-a",
    name: "Acme Co",
  });
  const project = await projects.create({
    tenantId: "tenant-a",
    clientId: client.id,
    name: "Website redesign",
    budget: 10000,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-12-01",
  });

  return { tasks, actionLogs, project };
};

describe("createTaskService", () => {
  it("creates a task on a project and writes an action log with correlationId", async () => {
    const { tasks, actionLogs, project } = await createStack();

    const created = await tasks.create({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "Draft homepage wireframe",
      description: "Low-fidelity layout",
      assignee: "alice@agency.test",
      correlationId: "corr-create-1",
      actorName: "agent-operator",
    });

    expect(created).toMatchObject({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "Draft homepage wireframe",
      description: "Low-fidelity layout",
      status: "todo",
      assignee: "alice@agency.test",
      mondayItemId: null,
      linearIssueId: null,
    });

    const logs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-create-1",
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      agentName: "agent-operator",
      toolName: "tasks.create",
      status: "success",
      correlationId: "corr-create-1",
      projectId: project.id,
      taskId: created.id,
    });
  });

  it("lists tasks for a project within the tenant", async () => {
    const { tasks, project } = await createStack();

    await tasks.create({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "Task one",
      correlationId: "corr-1",
      actorName: "agent-operator",
    });

    const listed = await tasks.listByProject("tenant-a", project.id);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.title).toBe("Task one");
  });

  it("updates task status and assignee and writes an action log", async () => {
    const { tasks, actionLogs, project } = await createStack();
    const created = await tasks.create({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "Task one",
      correlationId: "corr-create",
      actorName: "agent-operator",
    });

    expect(created.assignee).toBeNull();

    const updated = await tasks.update({
      tenantId: "tenant-a",
      taskId: created.id,
      status: "in_progress",
      assignee: "bob@agency.test",
      correlationId: "corr-update",
      actorName: "agent-operator",
    });

    expect(updated).toMatchObject({
      id: created.id,
      status: "in_progress",
      assignee: "bob@agency.test",
    });

    const logs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-update",
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      toolName: "tasks.update",
      correlationId: "corr-update",
      taskId: created.id,
    });
  });

  it("rejects create when the project is missing for the tenant", async () => {
    const { tasks } = await createStack();

    await expect(
      tasks.create({
        tenantId: "tenant-a",
        projectId: "missing-project",
        title: "Orphan task",
        correlationId: "corr-missing",
        actorName: "agent-operator",
      }),
    ).rejects.toThrow(/project/i);
  });
});
