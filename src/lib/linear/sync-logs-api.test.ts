import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemorySyncLogRepository } from "./sync-log-repository";
import { handleListSyncLogs } from "./sync-logs-api";

const operatorSession: AuthSession = {
  user: {
    id: "user-1",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

describe("handleListSyncLogs", () => {
  it("lists sync logs for the operator tenant", async () => {
    const syncLogs = createInMemorySyncLogRepository();
    await syncLogs.append({
      tenantId: "tenant-default",
      direction: "inbound",
      outcome: "rejected-field",
      message: "Rejected title",
      rejectedFields: ["title"],
    });
    await syncLogs.append({
      tenantId: "other",
      direction: "outbound",
      outcome: "success",
      message: "Other tenant",
    });

    const result = await handleListSyncLogs({
      session: operatorSession,
      syncLogs,
    });

    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("expected success");
    }
    expect(result.body).toHaveLength(1);
    expect(result.body[0]).toMatchObject({
      outcome: "rejected-field",
      message: "Rejected title",
    });
  });

  it("rejects unauthenticated access", async () => {
    const result = await handleListSyncLogs({
      session: null,
      syncLogs: createInMemorySyncLogRepository(),
    });
    expect(result).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });
});
