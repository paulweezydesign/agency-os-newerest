import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createSlackNotifier } from "./notify";
import { createInMemorySlackClient } from "./slack-client";

describe("createSlackNotifier", () => {
  it("posts policy-gate notifications and logs success", async () => {
    const slack = createInMemorySlackClient();
    const actionLogs = createInMemoryAgentActionLogRepository();
    const notifier = createSlackNotifier({ slack, actionLogs });

    await notifier.notifyPolicyGate({
      tenantId: "t1",
      event: "requested",
      correlationId: "c1",
      gate: {
        id: "g1",
        tenantId: "t1",
        actionType: "client_email",
        status: "pending",
        payload: {},
        requestedBy: "op",
        correlationId: "c1",
        effectRan: false,
        createdAt: new Date().toISOString(),
      },
    });

    expect(slack.messages).toHaveLength(1);
    expect(slack.messages[0]?.text).toMatch(/requested/);
    const logs = await actionLogs.listByCorrelationId("t1", "c1");
    expect(logs[0]?.status).toBe("success");
  });

  it("logs Slack failures without throwing", async () => {
    const slack = createInMemorySlackClient();
    slack.failNext("down");
    const actionLogs = createInMemoryAgentActionLogRepository();
    const notifier = createSlackNotifier({ slack, actionLogs });

    await expect(
      notifier.notifyBudgetAlert({
        tenantId: "t1",
        correlationId: "c2",
        alert: {
          id: "a1",
          tenantId: "t1",
          projectId: "p1",
          threshold: 80,
          spend: 80,
          budget: 100,
          createdAt: new Date().toISOString(),
        },
      }),
    ).resolves.toBeUndefined();

    const logs = await actionLogs.listByCorrelationId("t1", "c2");
    expect(logs[0]?.status).toBe("error");
    expect(slack.messages).toHaveLength(0);
  });

  it("notifies sync failures", async () => {
    const slack = createInMemorySlackClient();
    const actionLogs = createInMemoryAgentActionLogRepository();
    const notifier = createSlackNotifier({ slack, actionLogs });

    await notifier.notifySyncFailure({
      tenantId: "t1",
      tracker: "monday",
      correlationId: "c3",
      log: {
        taskId: "task-1",
        outcome: "conflict",
        message: "assignee mismatch",
        direction: "inbound",
      },
    });

    expect(slack.messages[0]?.text).toMatch(/monday sync conflict/);
  });
});
