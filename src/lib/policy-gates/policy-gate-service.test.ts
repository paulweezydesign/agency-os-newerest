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
  it.each([
    { payload: { to: "different@example.test" } },
    { dryRun: true },
    { actionType: "sow_send" as const },
    { projectId: "other-project" },
  ])("rejects reuse of a request key with conflicting input %j", async (change) => {
    const notifier = { notifyPolicyGate: vi.fn() };
    const repository = createInMemoryPolicyGateRepository();
    const service = createPolicyGateService(repository,
      createInMemoryAgentActionLogRepository(), vi.fn(), notifier);
    const input = { tenantId: "tenant-a", actionType: "client_email" as const,
      payload: { to: "lead@example.test" }, requestedBy: "operator",
      correlationId: "immutable", requestKey: "stable" };
    await service.request(input);
    notifier.notifyPolicyGate.mockClear();
    await expect(service.request({ ...input, ...change })).rejects.toThrow("different input");
    expect(notifier.notifyPolicyGate).not.toHaveBeenCalled();
    expect(await service.list("tenant-a")).toHaveLength(1);
  });

  it("records one durable dry-run receipt without invoking effects or notifications", async () => {
    const repository = createInMemoryPolicyGateRepository();
    const runEffect = vi.fn(async () => { throw new Error("Live effects forbidden"); });
    const notifier = { notifyPolicyGate: vi.fn() };
    const service = createPolicyGateService(repository,
      createInMemoryAgentActionLogRepository(), runEffect, notifier);
    const request = { tenantId: "tenant-a", actionType: "client_email" as const,
      payload: { to: "lead@example.test" }, requestedBy: "operator",
      correlationId: "dry-run", dryRun: true, requestKey: "run-1:email" };
    const [gate, retry] = await Promise.all([service.request(request), service.request(request)]);
    expect(gate.id).toBe(retry.id);
    const decision = { tenantId: "tenant-a", gateId: gate.id,
      decidedBy: "operator", correlationId: "dry-run" };
    const approved = await service.approve(decision);
    const recovered = await service.recover(decision);
    expect(approved.effectReceipt).toEqual(recovered.effectReceipt);
    expect(approved).toMatchObject({ effectRan: true, effectStatus: "succeeded",
      effectReceipt: { key: `policy-gate:${gate.id}`, mode: "dry-run" } });
    expect(runEffect).not.toHaveBeenCalled();
    expect(notifier.notifyPolicyGate).not.toHaveBeenCalled();
  });

  it("preserves failed dry runs for explicit concurrent recovery", async () => {
    const repository = createInMemoryPolicyGateRepository();
    const complete = vi.spyOn(repository, "completeDryRun")
      .mockRejectedValueOnce(new Error("DB write interrupted"));
    const runEffect = vi.fn();
    const service = createPolicyGateService(repository,
      createInMemoryAgentActionLogRepository(), runEffect);
    const gate = await service.request({ tenantId: "tenant-a", actionType: "client_email",
      payload: { to: "lead@example.test" }, requestedBy: "operator",
      correlationId: "recover", dryRun: true });
    const decision = { tenantId: "tenant-a", gateId: gate.id,
      decidedBy: "operator", correlationId: "recover" };
    await expect(service.approve(decision)).rejects.toThrow("explicit recovery");
    expect(await repository.getByTenantAndId("tenant-a", gate.id)).toMatchObject({
      status: "approved", effectRan: false, effectStatus: "failed" });
    const [first, second] = await Promise.all([service.recover(decision), service.recover(decision)]);
    expect(first.effectReceipt).toEqual(second.effectReceipt);
    expect(first.effectRan).toBe(true);
    expect(complete).toHaveBeenCalledTimes(3);
    expect(runEffect).not.toHaveBeenCalled();
  });

  it("keeps a receipt when completion succeeds but its response is lost", async () => {
    const repository = createInMemoryPolicyGateRepository();
    const original = repository.completeDryRun;
    vi.spyOn(repository, "completeDryRun").mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new Error("Response lost");
    });
    const service = createPolicyGateService(repository,
      createInMemoryAgentActionLogRepository(), vi.fn());
    const gate = await service.request({ tenantId: "tenant-a", actionType: "client_email",
      payload: { to: "lead@example.test" }, requestedBy: "operator",
      correlationId: "lost-response", dryRun: true });
    const decision = { tenantId: "tenant-a", gateId: gate.id,
      decidedBy: "operator", correlationId: "lost-response" };
    await expect(service.approve(decision)).rejects.toThrow("explicit recovery");
    const stored = await repository.getByTenantAndId("tenant-a", gate.id);
    expect(stored).toMatchObject({ effectRan: true, effectStatus: "succeeded" });
    expect((await service.recover(decision)).effectReceipt).toEqual(stored?.effectReceipt);
  });

  it("never retries an ambiguous generic effect failure", async () => {
    const repository = createInMemoryPolicyGateRepository();
    const runEffect = vi.fn(async () => { throw new Error("Remote outcome unknown"); });
    const service = createPolicyGateService(repository,
      createInMemoryAgentActionLogRepository(), runEffect);
    const gate = await service.request({ tenantId: "tenant-a", actionType: "client_email",
      payload: { to: "lead@example.test" }, requestedBy: "operator", correlationId: "unknown" });
    const decision = { tenantId: "tenant-a", gateId: gate.id,
      decidedBy: "operator", correlationId: "unknown" };
    await expect(service.approve(decision)).rejects.toThrow("manual reconciliation");
    expect(await repository.getByTenantAndId("tenant-a", gate.id))
      .toMatchObject({ status: "approved", effectRan: false, effectStatus: "unknown" });
    await expect(service.approve(decision)).rejects.toThrow();
    await expect(service.recover(decision)).rejects.toThrow();
    expect(runEffect).toHaveBeenCalledTimes(1);
  });

  it.each(["person@example.com", "not-an-email", "lead@not.test.example.com"])
    ("rejects nonsynthetic dry-run address %s", async (to) => {
      const { service, runEffect } = createService();
      await expect(service.request({ tenantId: "tenant-a", actionType: "client_email",
        payload: { to }, requestedBy: "operator", correlationId: "invalid", dryRun: true }))
        .rejects.toThrow();
      expect(await service.list("tenant-a")).toHaveLength(0);
      expect(runEffect).not.toHaveBeenCalled();
    });

  it("claims simultaneous approvals before executing an effect", async () => {
    const { service, runEffect } = createService();
    const gate = await service.request({
      tenantId: "tenant-a", actionType: "client_email",
      payload: { to: "lead@example.test" }, requestedBy: "operator",
      correlationId: "concurrent-approval",
    });
    const decide = { tenantId: "tenant-a", gateId: gate.id,
      decidedBy: "operator", correlationId: "concurrent-approval" };
    const results = await Promise.allSettled([
      service.approve(decide), service.approve(decide),
    ]);
    expect(runEffect).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(service.approve(decide)).rejects.toThrow();
    expect(runEffect).toHaveBeenCalledTimes(1);
  });

  it("cannot deny a gate after approval has started its effect", async () => {
    const repository = createInMemoryPolicyGateRepository();
    let release!: () => void;
    let started!: () => void;
    const effectStarted = new Promise<void>((resolve) => { started = resolve; });
    const effectFinished = new Promise<void>((resolve) => { release = resolve; });
    const runEffect = vi.fn(async () => { started(); await effectFinished; });
    const service = createPolicyGateService(repository,
      createInMemoryAgentActionLogRepository(), runEffect);
    const gate = await service.request({ tenantId: "tenant-a",
      actionType: "client_email", payload: { to: "lead@example.test" },
      requestedBy: "operator", correlationId: "approval-denial-race" });
    const decide = { tenantId: "tenant-a", gateId: gate.id,
      decidedBy: "operator", correlationId: "approval-denial-race" };
    const approving = service.approve(decide);
    await effectStarted;
    const [denial] = await Promise.allSettled([service.deny(decide)]);
    release();
    await approving;
    expect(denial.status).toBe("rejected");
    expect(await repository.getByTenantAndId("tenant-a", gate.id))
      .toMatchObject({ status: "approved", effectRan: true });
    expect(runEffect).toHaveBeenCalledTimes(1);
  });

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
      "corr-a",
    );
    const denyLogs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-b",
    );
    expect(approveLogs.find((log) => log.toolName === "policyGates.approve")?.input)
      .toMatchObject({ decisionCorrelationId: "corr-approve" });
    expect(denyLogs.find((log) => log.toolName === "policyGates.deny")?.input)
      .toMatchObject({ decisionCorrelationId: "corr-deny" });
  });
});
