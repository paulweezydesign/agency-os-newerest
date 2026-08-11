import { describe, expect, it, vi } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryPolicyGateRepository } from "./policy-gate-repository";
import { createPolicyGateService } from "./policy-gate-service";

const createService = () => {
  const repository = createInMemoryPolicyGateRepository();
  const actionLogs = createInMemoryAgentActionLogRepository();
  const runEffect = vi.fn(async () => ({ sent: true }));
  const service = createPolicyGateService(repository, actionLogs, runEffect);
  return { service, actionLogs, runEffect };
};

describe("createPolicyGateService", () => {
  it("creates a pending gate without running the side effect", async () => {
    const { service, runEffect, actionLogs } = createService();

    const gate = await service.request({
      tenantId: "tenant-a",
      actionType: "client_email",
      payload: { to: "client@example.com", subject: "Hello" },
      projectId: "proj-1",
      requestedBy: "project-manager",
      correlationId: "corr-req",
    });

    expect(gate.status).toBe("pending");
    expect(gate.effectRan).toBe(false);
    expect(runEffect).not.toHaveBeenCalled();

    const logs = await actionLogs.listByCorrelationId("tenant-a", "corr-req");
    expect(logs[0]).toMatchObject({
      toolName: "policyGates.request",
      status: "success",
    });
  });

  it("approve runs the effect once and deny never runs it", async () => {
    const { service, runEffect, actionLogs } = createService();

    const gate = await service.request({
      tenantId: "tenant-a",
      actionType: "sow_send",
      payload: { sowId: "sow-1" },
      requestedBy: "agent-operator",
      correlationId: "corr-a",
    });

    const approved = await service.approve({
      tenantId: "tenant-a",
      gateId: gate.id,
      decidedBy: "admin",
      correlationId: "corr-approve",
    });

    expect(approved.status).toBe("approved");
    expect(approved.effectRan).toBe(true);
    expect(runEffect).toHaveBeenCalledTimes(1);

    await expect(
      service.approve({
        tenantId: "tenant-a",
        gateId: gate.id,
        decidedBy: "admin",
        correlationId: "corr-approve-2",
      }),
    ).rejects.toThrow(/already approved|not pending/i);
    expect(runEffect).toHaveBeenCalledTimes(1);

    const deniedGate = await service.request({
      tenantId: "tenant-a",
      actionType: "invoice_or_deposit",
      payload: { amount: 500 },
      requestedBy: "project-manager",
      correlationId: "corr-b",
    });

    const denied = await service.deny({
      tenantId: "tenant-a",
      gateId: deniedGate.id,
      decidedBy: "agent-operator",
      correlationId: "corr-deny",
    });

    expect(denied.status).toBe("denied");
    expect(denied.effectRan).toBe(false);
    expect(runEffect).toHaveBeenCalledTimes(1);

    const approveLogs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-approve",
    );
    const denyLogs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-deny",
    );
    expect(approveLogs[0]?.toolName).toBe("policyGates.approve");
    expect(denyLogs[0]?.toolName).toBe("policyGates.deny");
  });
});
