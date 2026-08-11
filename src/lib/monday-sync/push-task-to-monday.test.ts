import { describe, expect, it } from "vitest";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createInMemoryMondayClient } from "./monday-client";
import { createInMemorySyncLogRepository } from "./sync-log-repository";
import { pushTaskToMonday, syncTaskToMonday } from "./push-task-to-monday";

describe("pushTaskToMonday", () => {
  it("creates a Monday item and stores mondayItemId on the task", async () => {
    const tasks = createInMemoryTaskRepository();
    const monday = createInMemoryMondayClient();
    const syncLogs = createInMemorySyncLogRepository();

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Draft homepage",
      description: "Scope",
      status: "todo",
      assignee: "alice@agency.test",
    });

    const result = await pushTaskToMonday({
      task,
      tasks,
      monday,
      syncLogs,
    });

    expect(result.mondayItemId).toBe("mon-1");
    expect(monday.items.get("mon-1")).toMatchObject({
      title: "Draft homepage",
      description: "Scope",
      status: "not_started",
      assignee: "alice@agency.test",
    });

    const stored = await tasks.getByTenantAndId("tenant-a", task.id);
    expect(stored?.mondayItemId).toBe("mon-1");

    const logs = await syncLogs.listByTenant("tenant-a");
    expect(logs[0]).toMatchObject({
      direction: "outbound",
      outcome: "success",
      taskId: task.id,
      mondayItemId: "mon-1",
    });
  });

  it("updates status and assignee on an existing Monday item", async () => {
    const tasks = createInMemoryTaskRepository();
    const monday = createInMemoryMondayClient();
    const syncLogs = createInMemorySyncLogRepository();

    const createdItem = await monday.createItem({
      title: "Draft homepage",
      description: "Scope",
      status: "not_started",
      assignee: "alice@agency.test",
    });

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Draft homepage",
      description: "Scope",
      status: "in_progress",
      assignee: "bob@agency.test",
      mondayItemId: createdItem.id,
    });

    await pushTaskToMonday({
      task,
      tasks,
      monday,
      syncLogs,
    });

    expect(monday.items.get(createdItem.id)).toMatchObject({
      status: "working_on_it",
      assignee: "bob@agency.test",
      title: "Draft homepage",
    });
  });
});

describe("syncTaskToMonday", () => {
  it("is a thin wrapper that pushes the given task", async () => {
    const tasks = createInMemoryTaskRepository();
    const monday = createInMemoryMondayClient();
    const syncLogs = createInMemorySyncLogRepository();
    const sync = syncTaskToMonday({ tasks, monday, syncLogs });

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Wireframe",
      description: "",
      status: "todo",
      assignee: null,
    });

    const result = await sync(task);
    expect(result.mondayItemId).toBe("mon-1");
  });
});
