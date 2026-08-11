import { describe, expect, it } from "vitest";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createInMemorySyncLogRepository } from "./sync-log-repository";
import { handleMondayWebhook } from "./monday-webhook-api";

describe("handleMondayWebhook", () => {
  it("accepts a valid payload and applies the patch", async () => {
    const tasks = createInMemoryTaskRepository();
    const syncLogs = createInMemorySyncLogRepository();
    await tasks.create({
      tenantId: "tenant-a",
      projectId: "p1",
      title: "T",
      description: "D",
      status: "todo",
      assignee: null,
      mondayItemId: "mon-1",
    });

    const result = await handleMondayWebhook({
      body: {
        action: "update",
        data: {
          id: "mon-1",
          title: "T",
          description: "D",
          status: "working_on_it",
          assignee: "a@test.com",
        },
      },
      tasks,
      syncLogs,
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ outcome: "success" });
  });

  it("rejects invalid payloads", async () => {
    const result = await handleMondayWebhook({
      body: { action: "update", data: {} },
      tasks: createInMemoryTaskRepository(),
      syncLogs: createInMemorySyncLogRepository(),
    });

    expect(result).toEqual({
      status: 400,
      body: { error: "Invalid webhook payload" },
    });
  });
});
