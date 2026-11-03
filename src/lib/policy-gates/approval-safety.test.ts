import { describe, it, expect, vi } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryPolicyGateRepository } from "./policy-gate-repository";
import { createPolicyGateService } from "./policy-gate-service";

const request = {
  tenantId: "tenant-test",
  actionType: "client_email" as const,
  payload: { to: "lead@example.test" },
  requestedBy: "operator",
  correlationId: "correlation-test",
};
const setup = () => {
  const repo = createInMemoryPolicyGateRepository();
  const logs = createInMemoryAgentActionLogRepository();
  const effect = vi.fn(async () => undefined);
  return {
    repo,
    logs,
    effect,
    service: createPolicyGateService(repo, logs, effect),
  };
};
const decision = (id: string) => ({
  tenantId: request.tenantId,
  gateId: id,
  decidedBy: "operator",
  correlationId: request.correlationId,
});

describe("durable approval safety contract", () => {
  it("claims before concurrent approvals reach the effect", async () => {
    const { service, effect } = setup();
    const gate = await service.request(request);
    await Promise.allSettled([
      service.approve(decision(gate.id)),
      service.approve(decision(gate.id)),
    ]);
    expect(effect).toHaveBeenCalledTimes(1);
  });
  it("keeps an uncertain effect blocked across service restart", async () => {
    const { service, effect, repo, logs } = setup();
    effect.mockRejectedValue(new Error("unknown outcome"));
    const gate = await service.request(request);
    await expect(service.approve(decision(gate.id))).rejects.toThrow();
    await expect(
      createPolicyGateService(repo, logs, effect).approve(decision(gate.id)),
    ).rejects.toThrow();
    await expect(service.deny(decision(gate.id))).rejects.toThrow();
    expect(effect).toHaveBeenCalledTimes(1);
  });
  it("does not run another effect after completion persistence fails", async () => {
    const { service, effect, repo, logs } = setup();
    const gate = await service.request(request);
    vi.spyOn(repo, "applyDecision").mockRejectedValue(
      new Error("write failed"),
    );
    await expect(service.approve(decision(gate.id))).rejects.toThrow();
    await expect(
      createPolicyGateService(repo, logs, effect).approve(decision(gate.id)),
    ).rejects.toThrow();
    expect(effect).toHaveBeenCalledTimes(1);
  });
  it("denial is terminal, tenant scoped, and effect free", async () => {
    const { service, effect } = setup();
    const gate = await service.request(request);
    await expect(
      service.approve({ ...decision(gate.id), tenantId: "other" }),
    ).rejects.toThrow();
    await service.deny(decision(gate.id));
    await expect(service.deny(decision(gate.id))).rejects.toThrow();
    await expect(service.approve(decision(gate.id))).rejects.toThrow();
    expect(effect).not.toHaveBeenCalled();
  });
});

it("does not undo a committed approval if its response or audit write fails", async () => {
  const { service, effect, repo, logs } = setup();
  const gate = await service.request(request);
  const apply = repo.applyDecision;
  vi.spyOn(repo, "applyDecision").mockImplementation(async (...args) => {
    await apply(...args);
    throw new Error("ack lost");
  });
  await expect(service.approve(decision(gate.id))).rejects.toThrow();
  expect((await repo.getByTenantAndId(request.tenantId, gate.id))?.status).toBe(
    "approved",
  );
  await expect(
    createPolicyGateService(repo, logs, effect).approve(decision(gate.id)),
  ).rejects.toThrow();
  expect(effect).toHaveBeenCalledTimes(1);
});
it("leaves a claim blocked if recording uncertainty also fails", async () => {
  const { service, effect, repo } = setup();
  const gate = await service.request(request);
  effect.mockRejectedValue(new Error("unknown effect"));
  vi.spyOn(repo, "markUncertain").mockRejectedValue(
    new Error("database offline"),
  );
  await expect(service.approve(decision(gate.id))).rejects.toThrow(
    "unknown effect",
  );
  await expect(service.approve(decision(gate.id))).rejects.toThrow();
  expect(
    (await repo.getByTenantAndId(request.tenantId, gate.id))?.executionState,
  ).toBe("claimed");
  expect(effect).toHaveBeenCalledTimes(1);
});
it("a denial racing approval permits only one durable decision", async () => {
  const { service, effect, repo } = setup();
  const gate = await service.request(request);
  const results = await Promise.allSettled([
    service.deny(decision(gate.id)),
    service.approve(decision(gate.id)),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const saved = await repo.getByTenantAndId(request.tenantId, gate.id);
  expect(effect).toHaveBeenCalledTimes(saved?.status === "approved" ? 1 : 0);
});

it("preserves a completed decision when audit persistence fails", async () => {
  const { service, effect, repo, logs } = setup();
  const gate = await service.request(request);
  vi.spyOn(logs, "append").mockRejectedValue(new Error("audit offline"));
  await expect(service.approve(decision(gate.id))).rejects.toThrow(
    "audit offline",
  );
  expect(await repo.getByTenantAndId(request.tenantId, gate.id)).toMatchObject({
    status: "approved",
    executionState: "completed",
  });
  await expect(service.approve(decision(gate.id))).rejects.toThrow();
  expect(effect).toHaveBeenCalledTimes(1);
});
