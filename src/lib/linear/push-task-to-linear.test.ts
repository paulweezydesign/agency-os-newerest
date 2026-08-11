import { describe, expect, it } from "vitest";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createInMemoryLinearClient } from "./linear-client";
import { createInMemorySyncLogRepository } from "./sync-log-repository";
import { pushTaskToLinear, syncTaskToLinear } from "./push-task-to-linear";

describe("pushTaskToLinear", () => {
  it("creates a Linear issue and stores linearIssueId on the task", async () => {
    const tasks = createInMemoryTaskRepository();
    const linear = createInMemoryLinearClient();
    const syncLogs = createInMemorySyncLogRepository();

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Draft homepage",
      description: "Scope",
      status: "todo",
      assignee: "alice@agency.test",
    });

    const result = await pushTaskToLinear({
      task,
      tasks,
      linear,
      syncLogs,
    });

    expect(result.linearIssueId).toBe("lin-1");
    expect(linear.issues.get("lin-1")).toMatchObject({
      title: "Draft homepage",
      description: "Scope",
      status: "unstarted",
      assignee: "alice@agency.test",
    });

    const stored = await tasks.getByTenantAndId("tenant-a", task.id);
    expect(stored?.linearIssueId).toBe("lin-1");

    const logs = await syncLogs.listByTenant("tenant-a");
    expect(logs[0]).toMatchObject({
      direction: "outbound",
      outcome: "success",
      taskId: task.id,
      linearIssueId: "lin-1",
    });
  });

  it("updates status and assignee on an existing Linear issue", async () => {
    const tasks = createInMemoryTaskRepository();
    const linear = createInMemoryLinearClient();
    const syncLogs = createInMemorySyncLogRepository();

    const createdIssue = await linear.createIssue({
      title: "Draft homepage",
      description: "Scope",
      status: "unstarted",
      assignee: "alice@agency.test",
    });

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Draft homepage",
      description: "Scope",
      status: "in_progress",
      assignee: "bob@agency.test",
      linearIssueId: createdIssue.id,
    });

    await pushTaskToLinear({
      task,
      tasks,
      linear,
      syncLogs,
    });

    expect(linear.issues.get(createdIssue.id)).toMatchObject({
      status: "started",
      assignee: "bob@agency.test",
      title: "Draft homepage",
    });
  });
});

describe("syncTaskToLinear", () => {
  it("is a thin wrapper that pushes the given task", async () => {
    const tasks = createInMemoryTaskRepository();
    const linear = createInMemoryLinearClient();
    const syncLogs = createInMemorySyncLogRepository();
    const sync = syncTaskToLinear({ tasks, linear, syncLogs });

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Wireframe",
      description: "",
      status: "todo",
      assignee: null,
    });

    const result = await sync(task);
    expect(result.linearIssueId).toBe("lin-1");
  });
});
