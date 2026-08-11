import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import { createInMemoryMondayClient } from "./monday-client";
import { createInMemorySyncLogRepository } from "./sync-log-repository";
import { syncTaskToMonday } from "./push-task-to-monday";
import { withMondayTaskSync } from "./with-monday-task-sync";

describe("withMondayTaskSync", () => {
  it("pushes create and status/assignee updates to Monday", async () => {
    const clients = createClientService(createInMemoryClientRepository());
    const projects = createProjectService(
      createInMemoryProjectRepository(),
      clients,
    );
    const taskRepo = createInMemoryTaskRepository();
    const monday = createInMemoryMondayClient();
    const syncLogs = createInMemorySyncLogRepository();
    const base = createTaskService(
      taskRepo,
      projects,
      createInMemoryAgentActionLogRepository(),
    );
    const tasks = withMondayTaskSync(
      base,
      syncTaskToMonday({ tasks: taskRepo, monday, syncLogs }),
    );

    const client = await clients.create({
      tenantId: "tenant-a",
      name: "Acme",
    });
    const project = await projects.create({
      tenantId: "tenant-a",
      clientId: client.id,
      name: "Site",
      budget: 1000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-10-01",
    });

    const created = await tasks.create({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "Task A",
      assignee: "alice@agency.test",
      correlationId: "c1",
      actorName: "agent-operator",
    });

    expect(created.mondayItemId).toBe("mon-1");
    expect(monday.items.get("mon-1")).toMatchObject({
      status: "not_started",
      assignee: "alice@agency.test",
    });

    const updated = await tasks.update({
      tenantId: "tenant-a",
      taskId: created.id,
      status: "done",
      assignee: "bob@agency.test",
      correlationId: "c2",
      actorName: "agent-operator",
    });

    expect(updated.mondayItemId).toBe("mon-1");
    expect(monday.items.get("mon-1")).toMatchObject({
      status: "done",
      assignee: "bob@agency.test",
    });
  });
});
