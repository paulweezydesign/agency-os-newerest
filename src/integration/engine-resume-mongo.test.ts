import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { getClientService } from "@/lib/clients/get-client-service";
import * as service from "@/lib/client-pipeline/workflow-service";
import { getClientPipelineRunModel } from "@/lib/client-pipeline/workflow-model";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";

const uri = process.env.MONGODB_TEST_URI;
describe.skipIf(!uri)("durable Mastra admission", () => {
  beforeAll(async () => {
    const address = new URL(uri!);
    if (address.hostname !== "127.0.0.1" || !address.pathname.includes("test")) throw new Error("Local test Mongo required");
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri!);
  });
  afterAll(async () => { await mongoose.disconnect(); });
  it("keeps terminal gates suspended until actual engine resume; rejects tenant/client substitution", async () => {
    const tenantId = `engine-${randomUUID()}`;
    const client = await (await getClientService()).create({ tenantId, name: "Engine test", contactEmail: "engine@example.test" });
    const input = { tenantId, clientId: client.id, operatorId: "test", runId: randomUUID(), correlationId: randomUUID(), leadScore: 70 };
    const first = await service.executeClientPipelineWorkflow(input);
    expect(first.engineState).toBe("suspended");
    const gates = await getPolicyGateService();
    await gates.approve({ tenantId, gateId: first.gates[0].id, decidedBy: "test", correlationId: input.correlationId });
    expect((await service.getClientPipelineWorkflowRun(tenantId, input.runId))?.status).toBe("awaiting_approval");
    await expect(service.resumeClientPipelineWorkflow("other", client.id, input.runId)).rejects.toMatchObject({ status: 404 });
    await expect(service.resumeClientPipelineWorkflow(tenantId, "000000000000000000000000", input.runId)).rejects.toMatchObject({ status: 404 });
    const resumed = await service.resumeClientPipelineWorkflow(tenantId, client.id, input.runId);
    expect(resumed.engineState).toBe("success");
    expect(resumed.status).toBe("completed");
    await expect(service.executeClientPipelineWorkflow({ ...input, runId: randomUUID() })).rejects.toMatchObject({ status: 409 });
    expect(resumed.gates[0].effectReceipt).toEqual((await gates.list(tenantId))[0].effectReceipt);
    expect(await getClientPipelineRunModel().countDocuments({ tenantId })).toBe(1);
  }, 30000);
});

// Compatibility and crash windows use real Mongo writes; all addresses are synthetic.
describe.skipIf(!uri)("engine fail-closed windows", () => {
  beforeAll(async () => { process.env.MONGODB_URI = uri; await mongoose.connect(uri!); });
  afterAll(async () => { await mongoose.disconnect(); });
  const seed = async () => {
    const tenantId = `window-${randomUUID()}`;
    const client = await (await getClientService()).create({ tenantId, name: "Window test", contactEmail: "window@example.test" });
    const input = { tenantId, clientId: client.id, operatorId: "test", runId: randomUUID(), correlationId: randomUUID(), leadScore: 70 };
    return { input, first: await service.executeClientPipelineWorkflow(input) };
  };
  it.each(["running", "failed", "unknown"])("blocks approved/%s without a receipt and resumes after explicit dry-run recovery", async (effectStatus) => {
    const { input, first } = await seed();
    const { getPolicyGateModel } = await import("@/lib/policy-gates/policy-gate-model");
    await getPolicyGateModel().updateOne({ _id: first.gates[0].id }, { $set: { status: "approved", effectStatus, effectRan: false } });
    await expect(service.resumeClientPipelineWorkflow(input.tenantId, input.clientId, input.runId)).rejects.toMatchObject({ status: 409 });
    expect((await service.getClientPipelineWorkflowRun(input.tenantId, input.runId))?.engineState).toBe("suspended");
    await (await getPolicyGateService()).recover({ tenantId: input.tenantId, gateId: first.gates[0].id, decidedBy: "test", correlationId: input.correlationId });
    const outcomes = await Promise.allSettled([service.resumeClientPipelineWorkflow(input.tenantId, input.clientId, input.runId), service.resumeClientPipelineWorkflow(input.tenantId, input.clientId, input.runId)]);
    expect(outcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect((await service.getClientPipelineWorkflowRun(input.tenantId, input.runId))?.engineState).toBe("success");
  });
  it.each(["claimed", "uncertain"])("never approves or denies an operator-era pending/%s gate", async (executionState) => {
    const { getPolicyGateModel } = await import("@/lib/policy-gates/policy-gate-model");
    const tenantId = `legacy-${randomUUID()}`;
    // Raw insertion represents a persisted old-branch shape, not a new request.
    const gate = await getPolicyGateModel().collection.insertOne({ tenantId, actionType: "client_email", status: "pending", executionState, payload: { to: "legacy@example.test" }, requestedBy: "test", correlationId: "legacy", effectRan: false, createdAt: new Date() });
    const gates = await getPolicyGateService();
    const decision = { tenantId, gateId: gate.insertedId.toString(), decidedBy: "test", correlationId: "legacy" };
    await expect(gates.approve(decision)).rejects.toThrow();
    await expect(gates.deny(decision)).rejects.toThrow();
    await expect(gates.recover(decision)).rejects.toThrow();
    expect(await getPolicyGateModel().findById(gate.insertedId)).toMatchObject({ status: "pending", effectRan: false });
  });
  it.each(["start", "resume"] as const)("blocks %s when snapshot persisted but admission update failed", async (phase) => {
    const { input, first } = await seed();
    const gates = await getPolicyGateService();
    await gates.deny({ tenantId: input.tenantId, gateId: first.gates[0].id, decidedBy: "test", correlationId: input.correlationId });
    const client = phase === "start" ? await (await getClientService()).create({ tenantId: input.tenantId, name: "Start window", contactEmail: "start@example.test" }) : null;
    const target = client ? { ...input, clientId: client.id, runId: randomUUID() } : input;
    const collection = getClientPipelineRunModel().collection;
    const original = collection.updateOne.bind(collection);
    const spy = vi.spyOn(collection, "updateOne").mockImplementation(async (...args) => {
      const update = args[1] as { $set?: { engineState?: string } };
      if (args[0].runId === target.runId && update.$set?.engineState === (phase === "start" ? "suspended" : "success")) throw new Error("Injected admission write failure after snapshot");
      return original(...args);
    });
    try {
      await expect(phase === "start" ? service.executeClientPipelineWorkflow(target) : service.resumeClientPipelineWorkflow(target.tenantId, target.clientId, target.runId)).rejects.toThrow();
    } finally { spy.mockRestore(); }
    const blocked = await service.executeClientPipelineWorkflow(target);
    expect(blocked.engineState).toBe("uncertain");
    await expect(service.resumeClientPipelineWorkflow(target.tenantId, target.clientId, target.runId)).rejects.toMatchObject({ status: 409 });
    const { MongoDBStore } = await import("@mastra/mongodb");
    const store = new MongoDBStore({ id: "inspect-test", uri: uri!, dbName: mongoose.connection.db!.databaseName });
    try {
      const workflows = await store.getStore("workflows");
      const snapshot = await workflows!.loadWorkflowSnapshot({ workflowName: "client-pipeline", runId: blocked.mastraRunId });
      expect(snapshot?.status).toBe(phase === "start" ? "suspended" : "success");
    } finally { await store.close(); }
  });
  it("keeps committed engine success inspectable after a lost admission response", async () => {
    const { input, first } = await seed();
    await (await getPolicyGateService()).deny({ tenantId: input.tenantId, gateId: first.gates[0].id, decidedBy: "test", correlationId: input.correlationId });
    const collection = getClientPipelineRunModel().collection;
    const original = collection.updateOne.bind(collection);
    const spy = vi.spyOn(collection, "updateOne").mockImplementation(async (...args) => {
      const response = await original(...args);
      if (args[0].runId === input.runId && (args[1] as { $set?: { engineState?: string } }).$set?.engineState === "success") throw new Error("Lost committed response");
      return response;
    });
    try { await expect(service.resumeClientPipelineWorkflow(input.tenantId, input.clientId, input.runId)).rejects.toThrow(); }
    finally { spy.mockRestore(); }
    expect((await service.executeClientPipelineWorkflow(input)).engineState).toBe("success");
  });
  it("preserves a gate created before application checkpoint failure without replay", async () => {
    const tenantId = `orphan-${randomUUID()}`;
    const client = await (await getClientService()).create({ tenantId, name: "Orphan test", contactEmail: "orphan@example.test" });
    const input = { tenantId, clientId: client.id, operatorId: "test", runId: randomUUID(), correlationId: randomUUID(), leadScore: 70 };
    const collection = getClientPipelineRunModel().collection;
    const original = collection.updateOne.bind(collection);
    const spy = vi.spyOn(collection, "updateOne").mockImplementation(async (...args) => {
      if (args[0].runId === input.runId && (args[1] as { $set?: { result?: unknown } }).$set?.result) throw new Error("Checkpoint write failed");
      return original(...args);
    });
    try { await expect(service.executeClientPipelineWorkflow(input)).rejects.toThrow(); }
    finally { spy.mockRestore(); }
    const view = await service.executeClientPipelineWorkflow(input);
    expect(view.engineState).toBe("uncertain");
    expect(view.gates).toHaveLength(1);
    expect((await (await getPolicyGateService()).list(tenantId))).toHaveLength(1);
  });

  it("allows only one of two new identities racing for the same Client", async () => {
    const tenantId = `race-${randomUUID()}`;
    const client = await (await getClientService()).create({ tenantId, name: "Race test", contactEmail: "race@example.test" });
    const input = { tenantId, clientId: client.id, operatorId: "test", runId: randomUUID(), correlationId: randomUUID(), leadScore: 70 };
    const results = await Promise.allSettled([service.executeClientPipelineWorkflow(input), service.executeClientPipelineWorkflow({ ...input, runId: randomUUID(), leadScore: 45 })]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(await getClientPipelineRunModel().countDocuments({ tenantId })).toBe(1);
    expect((await (await getPolicyGateService()).list(tenantId))).toHaveLength(1);
  });
  it("fails closed when engine snapshot writes fail after admission", async () => {
    const { MongoDBStore } = await import("@mastra/mongodb");
    const store = new MongoDBStore({ id: "fault-test", uri: uri!, dbName: mongoose.connection.db!.databaseName });
    const domain = await store.getStore("workflows");
    const prototype = Object.getPrototypeOf(domain) as { persistWorkflowSnapshot: (...args: unknown[]) => Promise<void> };
    const spy = vi.spyOn(prototype, "persistWorkflowSnapshot").mockRejectedValue(new Error("Injected snapshot unavailable"));
    const tenantId = `snapshot-${randomUUID()}`;
    const client = await (await getClientService()).create({ tenantId, name: "Snapshot test", contactEmail: "snapshot@example.test" });
    const input = { tenantId, clientId: client.id, operatorId: "test", runId: randomUUID(), correlationId: randomUUID(), leadScore: 70 };
    try { await expect(service.executeClientPipelineWorkflow(input)).rejects.toThrow(); }
    finally { spy.mockRestore(); await store.close(); }
    expect((await service.executeClientPipelineWorkflow(input)).engineState).toBe("uncertain");
    await expect(service.resumeClientPipelineWorkflow(tenantId, client.id, input.runId)).rejects.toMatchObject({ status: 409 });
  });

});
