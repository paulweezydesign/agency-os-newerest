import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "./task-repository";
import { createTaskService } from "./task-service";
import {
  handleCreateTask,
  handleListTasksForProject,
  handleUpdateTask,
} from "./tasks-api";

const operatorSession: AuthSession = {
  user: {
    id: "user-operator",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

const clientRoleSession: AuthSession = {
  user: {
    id: "user-client",
    role: "client",
    tenantId: "tenant-default",
  },
};

const createDeps = async () => {
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

  return { tasks, actionLogs, project };
};

describe("tasks API handlers", () => {
  it("allows an operator to create, list, and update tasks", async () => {
    const { tasks, actionLogs, project } = await createDeps();
    const headers = new Headers({ "x-correlation-id": "corr-api-1" });

    const created = await handleCreateTask({
      session: operatorSession,
      service: tasks,
      projectId: project.id,
      body: { title: "Draft wireframe", description: "Home page" },
      headers,
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: "Draft wireframe",
      status: "todo",
      projectId: project.id,
    });

    const listed = await handleListTasksForProject({
      session: operatorSession,
      service: tasks,
      projectId: project.id,
    });
    expect(listed.status).toBe(200);
    if (listed.status !== 200) {
      throw new Error("expected list success");
    }
    expect(listed.body).toHaveLength(1);

    const taskId =
      created.status === 201 && "id" in created.body ? created.body.id : "";

    const updated = await handleUpdateTask({
      session: operatorSession,
      service: tasks,
      taskId,
      body: { status: "done" },
      headers: new Headers({ "x-correlation-id": "corr-api-2" }),
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ status: "done" });

    const createLogs = await actionLogs.listByCorrelationId(
      "tenant-default",
      "corr-api-1",
    );
    const updateLogs = await actionLogs.listByCorrelationId(
      "tenant-default",
      "corr-api-2",
    );
    expect(createLogs).toHaveLength(1);
    expect(updateLogs).toHaveLength(1);
  });

  it("rejects unauthenticated and client-role access", async () => {
    const { tasks, project } = await createDeps();

    const unauth = await handleCreateTask({
      session: null,
      service: tasks,
      projectId: project.id,
      body: { title: "Nope" },
    });
    const forbidden = await handleListTasksForProject({
      session: clientRoleSession,
      service: tasks,
      projectId: project.id,
    });

    expect(unauth).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
    expect(forbidden).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("returns 404 when creating under a missing project", async () => {
    const { tasks } = await createDeps();

    const result = await handleCreateTask({
      session: operatorSession,
      service: tasks,
      projectId: "missing-project",
      body: { title: "Orphan" },
    });

    expect(result).toEqual({
      status: 404,
      body: { error: "Project not found" },
    });
  });
});
