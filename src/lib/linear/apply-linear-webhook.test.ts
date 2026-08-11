import { describe, expect, it } from "vitest";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createInMemorySyncLogRepository } from "./sync-log-repository";
import { applyLinearWebhook } from "./apply-linear-webhook";

describe("applyLinearWebhook", () => {
  it("updates task status and assignee from Linear", async () => {
    const tasks = createInMemoryTaskRepository();
    const syncLogs = createInMemorySyncLogRepository();

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Draft homepage",
      description: "Agency scope",
      status: "todo",
      assignee: "alice@agency.test",
      linearIssueId: "lin-9",
    });

    const result = await applyLinearWebhook({
      payload: {
        action: "update",
        data: {
          id: "lin-9",
          title: "Draft homepage",
          description: "Agency scope",
          status: "started",
          assignee: "bob@agency.test",
        },
      },
      tasks,
      syncLogs,
    });

    expect(result).toMatchObject({
      outcome: "success",
      taskId: task.id,
    });

    const updated = await tasks.getByTenantAndId("tenant-a", task.id);
    expect(updated).toMatchObject({
      status: "in_progress",
      assignee: "bob@agency.test",
      title: "Draft homepage",
      description: "Agency scope",
    });

    const logs = await syncLogs.listByTenant("tenant-a");
    expect(logs[0]).toMatchObject({
      direction: "inbound",
      outcome: "success",
    });
  });

  it("rejects title/description edits, parks them in the sync log, and still applies status/assignee", async () => {
    const tasks = createInMemoryTaskRepository();
    const syncLogs = createInMemorySyncLogRepository();

    const task = await tasks.create({
      tenantId: "tenant-a",
      projectId: "project-1",
      title: "Draft homepage",
      description: "Agency scope",
      status: "todo",
      assignee: null,
      linearIssueId: "lin-9",
    });

    const result = await applyLinearWebhook({
      payload: {
        action: "update",
        data: {
          id: "lin-9",
          title: "Hijacked",
          description: "Not owned",
          status: "completed",
          assignee: "carol@agency.test",
        },
      },
      tasks,
      syncLogs,
    });

    expect(result.outcome).toBe("rejected-field");
    expect(result.rejectedFields).toEqual(["title", "description"]);

    const updated = await tasks.getByTenantAndId("tenant-a", task.id);
    expect(updated).toMatchObject({
      status: "done",
      assignee: "carol@agency.test",
      title: "Draft homepage",
      description: "Agency scope",
    });

    const logs = await syncLogs.listByTenant("tenant-a");
    expect(logs[0]).toMatchObject({
      direction: "inbound",
      outcome: "rejected-field",
      rejectedFields: ["title", "description"],
    });
  });

  it("returns conflict when the Linear issue is unknown", async () => {
    const tasks = createInMemoryTaskRepository();
    const syncLogs = createInMemorySyncLogRepository();

    const result = await applyLinearWebhook({
      payload: {
        action: "update",
        data: {
          id: "missing",
          title: "Orphan",
          description: "",
          status: "unstarted",
          assignee: null,
        },
      },
      tasks,
      syncLogs,
      defaultTenantId: "tenant-a",
    });

    expect(result.outcome).toBe("conflict");
    const logs = await syncLogs.listByTenant("tenant-a");
    expect(logs[0]).toMatchObject({
      outcome: "conflict",
      direction: "inbound",
    });
  });
});
