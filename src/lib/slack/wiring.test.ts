import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import {
  createDemoEffectRunner,
  createDemoEffectStore,
} from "@/lib/policy-gates/demo-effects";
import { createInMemoryPolicyGateRepository } from "@/lib/policy-gates/policy-gate-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemorySyncLogRepository } from "@/lib/monday-sync/sync-log-repository";
import { createSlackNotifier } from "./notify";
import { createNotifyingSyncLogRepository } from "./notifying-sync-log-repository";
import { createInMemorySlackClient } from "./slack-client";

describe("Slack notification wiring", () => {
  it("notifies on policy gate request/approve/deny", async () => {
    const slack = createInMemorySlackClient();
    const actionLogs = createInMemoryAgentActionLogRepository();
    const notifier = createSlackNotifier({ slack, actionLogs });
    const gates = createPolicyGateService(
      createInMemoryPolicyGateRepository(),
      actionLogs,
      createDemoEffectRunner(createDemoEffectStore()),
      notifier,
    );

    const gate = await gates.request({
      tenantId: "t1",
      actionType: "sow_send",
      requestedBy: "op",
      correlationId: "c1",
      payload: { title: "SOW" },
    });
    await gates.approve({
      tenantId: "t1",
      gateId: gate.id,
      decidedBy: "op",
      correlationId: "c2",
    });

    const denied = await gates.request({
      tenantId: "t1",
      actionType: "client_email",
      requestedBy: "op",
      correlationId: "c3",
      payload: { to: "a@b.com", subject: "x", body: "y" },
    });
    await gates.deny({
      tenantId: "t1",
      gateId: denied.id,
      decidedBy: "op",
      correlationId: "c4",
    });

    expect(slack.messages.map((m) => m.text)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/requested/),
        expect.stringMatching(/approved/),
        expect.stringMatching(/denied/),
      ]),
    );
  });

  it("notifies when a new budget threshold alert is created", async () => {
    const slack = createInMemorySlackClient();
    const actionLogs = createInMemoryAgentActionLogRepository();
    const notifier = createSlackNotifier({ slack, actionLogs });
    const clients = createClientService(createInMemoryClientRepository());
    const client = await clients.create({ tenantId: "t1", name: "Acme" });
    const projects = createProjectService(
      createInMemoryProjectRepository(),
      clients,
      createInMemoryBudgetAlertRepository(),
      notifier,
    );
    const project = await projects.create({
      tenantId: "t1",
      clientId: client.id,
      name: "P",
      budget: 100,
      timelineStart: "2026-01-01",
      timelineEnd: "2026-02-01",
    });

    await projects.recordSpend({
      tenantId: "t1",
      projectId: project.id,
      amount: 80,
    });

    expect(slack.messages.some((m) => m.text.includes("80%"))).toBe(true);

    await projects.recordSpend({
      tenantId: "t1",
      projectId: project.id,
      amount: 1,
    });

    const eightyCount = slack.messages.filter((m) =>
      m.text.includes("80%"),
    ).length;
    expect(eightyCount).toBe(1);
  });

  it("notifies on sync log conflict", async () => {
    const slack = createInMemorySlackClient();
    const actionLogs = createInMemoryAgentActionLogRepository();
    const notifier = createSlackNotifier({ slack, actionLogs });
    const syncLogs = createNotifyingSyncLogRepository(
      createInMemorySyncLogRepository(),
      notifier,
      "monday",
    );

    await syncLogs.append({
      tenantId: "t1",
      taskId: "task-1",
      direction: "outbound",
      outcome: "conflict",
      message: "status clash",
    });

    expect(slack.messages[0]?.text).toMatch(/conflict/);
  });
});
