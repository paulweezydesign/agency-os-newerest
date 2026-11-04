import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClientService } from "@/lib/clients/client-service";
import { getClientService } from "@/lib/clients/get-client-service";
import { getClientModel } from "@/lib/clients/client-model";
import { createMongooseClientRepository } from "@/lib/clients/mongoose-client-repository";
import { handleCreateClient } from "@/lib/clients/clients-api";
import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { createMongoosePolicyGateRepository } from "@/lib/policy-gates/mongoose-policy-gate-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import { getPolicyGateModel } from "@/lib/policy-gates/policy-gate-model";
import { handleDecidePolicyGate } from "@/lib/policy-gates/policy-gates-api";
import { executeClientPipelineWorkflow, getClientPipelineWorkflowRun } from "@/lib/client-pipeline/workflow-service";
import { getClientPipelineRunModel } from "@/lib/client-pipeline/workflow-model";
import { handleRunWorkflow } from "@/lib/client-pipeline/workflow-api";

const uri = process.env.MONGODB_TEST_URI;
const restartFixture = process.env.AGENCYOS_RESTART_FIXTURE;
const tenantId = `issue27-test-${randomUUID()}`;
const session = { user: { id: "synthetic-operator", role: "agent-operator", tenantId } };
const clients = () => createClientService(createMongooseClientRepository());
const logs = () => createMongooseAgentActionLogRepository();
const noExternalEffect = vi.fn(async () => { throw new Error("External effects are forbidden in this suite"); });
const noNotification = vi.fn(async () => { throw new Error("External notifications are forbidden in this suite"); });
const gates = () => createPolicyGateService(createMongoosePolicyGateRepository(), logs(),
  noExternalEffect, { notifyPolicyGate: noNotification });
const decision = (gateId: string, correlationId: string = randomUUID()) => ({
  tenantId, gateId, correlationId, decidedBy: "synthetic-operator",
});
const request = (requestKey = randomUUID()) => gates().request({
  tenantId, actionType: "client_email", payload: { to: "lead@example.test" },
  requestedBy: "synthetic-operator", correlationId: randomUUID(), dryRun: true, requestKey,
});
const lead = async (leadScore: number, contactEmail: string | undefined = "lead@example.test") => {
  const client = await clients().create({ tenantId, name: "Example Test Agency", contactEmail });
  return { tenantId, operatorId: "synthetic-operator", clientId: client.id,
    leadScore, runId: randomUUID(), correlationId: randomUUID() };
};

// Deliberately opt-in: these tests use real MongoDB, never repository substitutes.
describe.skipIf(!uri || Boolean(restartFixture))("MongoDB lead workflow acceptance", () => {
  beforeAll(async () => {
    const address = new URL(uri!);
    if (!["127.0.0.1", "localhost"].includes(address.hostname) || !address.pathname.includes("test")) {
      throw new Error("MONGODB_TEST_URI must select a local test database");
    }
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri!, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([getPolicyGateModel().init(), getClientPipelineRunModel().init()]);
  }, 30_000);
  afterAll(async () => { await mongoose.disconnect(); });

  it.each([[39, "disqualified"], [40, "nurture"], [69, "nurture"], [70, "onboard"]] as const)(
    "executes actual Mastra routing for score %i", async (score, stage) => {
      const input = await lead(score);
      const result = await executeClientPipelineWorkflow(input);
      expect((await clients().get(tenantId, input.clientId))?.pipelineStage).toBe(stage);
      expect(result.status).toBe(score < 40 ? "completed" : "awaiting_approval");
      expect(result.gates).toHaveLength(score < 40 ? 0 : 1);
      expect(result.gates.every((gate) => gate.status === "pending" && gate.dryRun && !gate.effectRan)).toBe(true);
      const audit = await logs().listByCorrelationId(tenantId, input.correlationId);
      expect(audit.length).toBeGreaterThan(0);
      expect(audit.every((event) => event.tenantId === tenantId)).toBe(true);
      expect(noExternalEffect).not.toHaveBeenCalled();
      expect(noNotification).not.toHaveBeenCalled();
    }, 30_000,
  );

  it("persists authenticated intake, scoring, workflow and approval in a fresh Node process", async () => {
    const created = await handleCreateClient({ session, service: clients(),
      body: { name: "Example Test Agency", contactEmail: "persist@example.test" } });
    if (created.status !== 201) throw new Error("Intake failed");
    const input = { tenantId, operatorId: session.user.id, clientId: created.body.id,
      leadScore: 70, runId: randomUUID(), correlationId: randomUUID() };
    const result = await executeClientPipelineWorkflow(input);
    const gate = result.gates[0];
    const approved = await gates().approve(decision(gate.id, input.correlationId));
    const fixture = { ...input, gateId: gate.id, receipt: approved.effectReceipt,
      auditIds: (await logs().listByCorrelationId(tenantId, input.correlationId)).map((event) => event.id) };
    const evidence = JSON.parse(execFileSync(process.execPath,
      [path.resolve("scripts/verify-mongo-persistence.mjs"), JSON.stringify({ ...input, gateId: gate.id })],
      { env: { ...process.env, MONGODB_TEST_URI: uri }, encoding: "utf8", timeout: 30_000 }));
    expect(evidence.client).toMatchObject({ name: "Example Test Agency", contactEmail: "persist@example.test",
      leadScore: 70, pipelineStage: "onboard", workflowRunId: input.runId });
    expect(evidence.run).toMatchObject({ runId: input.runId, correlationId: input.correlationId });
    expect(evidence.gate).toMatchObject({ status: "approved", effectRan: true,
      effectReceipt: { mode: "dry-run" } });
    expect(evidence.logs).toBeGreaterThan(0);
    expect((await executeClientPipelineWorkflow(input)).gates).toHaveLength(1);
    execFileSync(process.execPath, [path.resolve("node_modules/vitest/vitest.mjs"), "run",
      "src/integration/client-pipeline-mongo.test.ts", "--maxWorkers=1", "-t", "replays persisted workflow from a fresh process"],
    { env: { ...process.env, AGENCYOS_RESTART_FIXTURE: JSON.stringify(fixture) },
      encoding: "utf8", timeout: 30_000, stdio: "pipe" });
    if (process.env.AGENCYOS_MONGO_EVIDENCE_FILE) {
      writeFileSync(process.env.AGENCYOS_MONGO_EVIDENCE_FILE, JSON.stringify({ ...fixture, observed: evidence }, null, 2));
    }
  }, 45_000);

  it("runs authenticated score 45 intake to human denial with zero effects", async () => {
    const input = await lead(45);
    const response = await handleRunWorkflow({ session, enabled: true, clientId: input.clientId,
      body: { runId: input.runId, leadScore: 45 }, execute: executeClientPipelineWorkflow });
    expect(response.status).toBe(200);
    const run = response.body as Awaited<ReturnType<typeof executeClientPipelineWorkflow>>;
    expect(run.result!.client.pipelineStage).toBe("nurture");
    expect(run.gates).toHaveLength(1);
    const denied = await handleDecidePolicyGate({ session, service: gates(), gateId: run.gates[0].id,
      body: { decision: "deny", correlationId: run.correlationId } });
    expect(denied.status).toBe(200);
    expect(await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, run.gates[0].id))
      .toMatchObject({ status: "denied", effectRan: false });
    expect(noExternalEffect).not.toHaveBeenCalled();
    expect(noNotification).not.toHaveBeenCalled();
  });

  it("deduplicates simultaneous and retried workflow runs and rejects changed inputs", async () => {
    const input = await lead(70);
    const simultaneous = await Promise.allSettled([executeClientPipelineWorkflow(input), executeClientPipelineWorkflow(input)]);
    expect(simultaneous.some((result) => result.status === "fulfilled")).toBe(true);
    const run = await executeClientPipelineWorkflow(input);
    expect(run.gates).toHaveLength(1);
    expect(await getPolicyGateModel().countDocuments({ tenantId, requestKey: `client-pipeline:${input.runId}` })).toBe(1);
    expect(await getClientPipelineRunModel().countDocuments({ tenantId, runId: input.runId })).toBe(1);
    await expect(executeClientPipelineWorkflow({ ...input, leadScore: 40 })).rejects.toThrow();
    await expect(executeClientPipelineWorkflow({ ...input, runId: randomUUID() }))
      .rejects.toMatchObject({ status: 409 });
  }, 30_000);

  it("re-enters a workflow after a lost result checkpoint without duplicating its approved gate", async () => {
    const input = await lead(70);
    const first = await executeClientPipelineWorkflow(input);
    const approved = await gates().approve(decision(first.gates[0].id));
    // Model a process dying after the domain action but before saving its result.
    await getClientPipelineRunModel().updateOne({ tenantId, runId: input.runId }, {
      $unset: { result: 1 }, $set: { status: "failed", lastErrorCode: "INJECTED_LOST_CHECKPOINT" },
    });
    const recovered = await executeClientPipelineWorkflow(input);
    expect(recovered.status).toBe("completed");
    expect(recovered.gates).toHaveLength(1);
    expect(recovered.gates[0].id).toBe(approved.id);
    expect(recovered.gates[0].effectReceipt).toEqual(approved.effectReceipt);
    expect(await getPolicyGateModel().countDocuments({ tenantId, requestKey: `client-pipeline:${input.runId}` })).toBe(1);
    expect((await clients().get(tenantId, input.clientId))?.pipelineStage).toBe("onboard");
  });

  it("rejects legacy pipeline writes to a workflow-owned Client", async () => {
    const input = await lead(70);
    const run = await executeClientPipelineWorkflow(input);
    const legacy = await getClientService();
    await expect(legacy.updatePipeline(tenantId, input.clientId, {
      pipelineStage: "nurture", leadScore: 45, contactEmail: "changed@example.test",
    })).rejects.toMatchObject({ name: "ClientWorkflowReservedError" });
    expect(await legacy.get(tenantId, input.clientId)).toMatchObject({
      pipelineStage: "onboard", leadScore: 70, contactEmail: "lead@example.test",
    });
    expect(run.gates).toHaveLength(1);
    expect(run.gates[0].payload.to).toBe("lead@example.test");
  });

  it("rejects a legacy write started before workflow reservation but committed after it", async () => {
    const input = await lead(70);
    const legacy = await getClientService();
    let release!: () => void;
    let started!: () => void;
    const pendingLegacy = new Promise<void>((resolve) => { started = resolve; });
    const permitLegacy = new Promise<void>((resolve) => { release = resolve; });
    const collection = getClientModel().collection;
    const original = collection.findOneAndUpdate.bind(collection);
    // Hold only the legacy database operation, after its service call has begun.
    const spy = vi.spyOn(collection, "findOneAndUpdate").mockImplementation(async (...args) => {
      const update = args[1] as { $set?: { leadScore?: number } };
      if (String(args[0]._id) === input.clientId && update.$set?.leadScore === 45) {
        started();
        await permitLegacy;
      }
      return original(...args);
    });
    const pending = Promise.allSettled([legacy.updatePipeline(tenantId, input.clientId, {
      pipelineStage: "nurture", leadScore: 45, contactEmail: "changed@example.test",
    })]);
    try {
      await pendingLegacy;
      const run = await executeClientPipelineWorkflow(input);
      release();
      const [legacyResult] = await pending;
      expect(legacyResult.status).toBe("rejected");
      expect(await legacy.get(tenantId, input.clientId)).toMatchObject({
        pipelineStage: "onboard", leadScore: 70, contactEmail: "lead@example.test",
      });
      expect(run.gates).toHaveLength(1);
      expect(run.gates[0].payload.to).toBe("lead@example.test");
    } finally {
      release();
      await pending;
      spy.mockRestore();
    }
  });

  it("refuses interrupted workflow recovery when a legacy write won before Client reservation", async () => {
    const input = await lead(70);
    await getClientPipelineRunModel().create({ tenantId, runId: input.runId,
      clientId: input.clientId, correlationId: input.correlationId, mastraRunId: "interrupted-before-reservation",
      input, contactEmail: "lead@example.test", status: "running", checkpoints: ["input-persisted"] });
    const legacy = await getClientService();
    await legacy.updatePipeline(tenantId, input.clientId, {
      pipelineStage: "nurture", leadScore: 45, contactEmail: "changed@example.test",
    });
    await expect(executeClientPipelineWorkflow(input)).rejects.toMatchObject({ status: 409 });
    expect(await getPolicyGateModel().countDocuments({ tenantId, requestKey: `client-pipeline:${input.runId}` })).toBe(0);
    expect(await legacy.get(tenantId, input.clientId)).toMatchObject({
      pipelineStage: "nurture", leadScore: 45, contactEmail: "changed@example.test",
    });
  });

  it("recovers an input checkpoint created before an otherwise untouched Client was reserved", async () => {
    const input = await lead(70);
    await getClientPipelineRunModel().create({ tenantId, runId: input.runId,
      clientId: input.clientId, correlationId: input.correlationId, mastraRunId: "interrupted-before-reservation",
      input, contactEmail: "lead@example.test", status: "running", checkpoints: ["input-persisted"] });
    const run = await executeClientPipelineWorkflow(input);
    expect(run.status).toBe("awaiting_approval");
    expect(run.gates).toHaveLength(1);
    await expect((await getClientService()).updatePipeline(tenantId, input.clientId, {
      pipelineStage: "nurture", leadScore: 45,
    })).rejects.toMatchObject({ name: "ClientWorkflowReservedError" });
  });

  it("rejects invalid scores, unknown clients and tenant crossing before gate creation", async () => {
    const input = await lead(70);
    for (const score of [-1, 101, 1.5, Number.NaN]) {
      await expect(executeClientPipelineWorkflow({ ...input, leadScore: score })).rejects.toThrow();
    }
    await expect(executeClientPipelineWorkflow({ ...input, clientId: new mongoose.Types.ObjectId().toString() })).rejects.toThrow();
    await expect(executeClientPipelineWorkflow({ ...input, tenantId: "another-tenant" })).rejects.toThrow();
    expect(await getClientPipelineWorkflowRun("another-tenant", input.runId)).toBeNull();
    expect(await getPolicyGateModel().countDocuments({ tenantId, requestKey: `client-pipeline:${input.runId}` })).toBe(0);
  });

  it("rejects real recipient addresses and missing email before workflow gate creation", async () => {
    await expect(executeClientPipelineWorkflow(await lead(70, "not-synthetic@example.com"))).rejects.toThrow();
    const client = await clients().create({ tenantId, name: "No Email Test Agency" });
    await expect(executeClientPipelineWorkflow({ tenantId, operatorId: session.user.id,
      clientId: client.id, leadScore: 70, runId: randomUUID(), correlationId: randomUUID() })).rejects.toThrow();
  });

  it("writes one receipt for simultaneous approvals from independent services and retried approval", async () => {
    const gate = await request();
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => gates().approve(decision(gate.id))));
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const saved = await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, gate.id);
    expect(saved).toMatchObject({ status: "approved", effectRan: true, effectStatus: "succeeded" });
    const receipt = saved!.effectReceipt;
    await expect(gates().approve(decision(gate.id))).rejects.toThrow();
    await gates().recover(decision(gate.id));
    expect((await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, gate.id))!.effectReceipt).toEqual(receipt);
    expect(noExternalEffect).not.toHaveBeenCalled();
  });

  it("deduplicates simultaneous request keys using the Mongo unique index", async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 8 }, () => request(key)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(await getPolicyGateModel().countDocuments({ tenantId, requestKey: key })).toBe(1);
  });

  it("claims generic approvals in Mongo before any runner invocation", async () => {
    let release!: () => void;
    let started!: () => void;
    const effectStarted = new Promise<void>((resolve) => { started = resolve; });
    const effectReleased = new Promise<void>((resolve) => { release = resolve; });
    const safeRunner = vi.fn(async () => { started(); await effectReleased; return { synthetic: true }; });
    const service = () => createPolicyGateService(createMongoosePolicyGateRepository(), logs(), safeRunner);
    const gate = await service().request({ tenantId, actionType: "client_email",
      payload: { to: "generic@example.test" }, requestedBy: session.user.id, correlationId: randomUUID() });
    const first = service().approve(decision(gate.id));
    await effectStarted;
    const competitors = await Promise.allSettled([service().approve(decision(gate.id)), service().deny(decision(gate.id))]);
    release();
    await first;
    expect(competitors.every((entry) => entry.status === "rejected")).toBe(true);
    await expect(service().approve(decision(gate.id))).rejects.toThrow();
    expect(safeRunner).toHaveBeenCalledTimes(1);
  });

  it("fails closed after an ambiguous generic effect failure", async () => {
    const failedRunner = vi.fn(async () => { throw new Error("Synthetic ambiguous runner failure"); });
    const service = createPolicyGateService(createMongoosePolicyGateRepository(), logs(), failedRunner);
    const gate = await service.request({ tenantId, actionType: "client_email",
      payload: { to: "unknown@example.test" }, requestedBy: session.user.id, correlationId: randomUUID() });
    await expect(service.approve(decision(gate.id))).rejects.toThrow();
    expect(await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, gate.id))
      .toMatchObject({ status: "approved", effectRan: false, effectStatus: "unknown" });
    await expect(service.approve(decision(gate.id))).rejects.toThrow();
    await expect(service.recover(decision(gate.id))).rejects.toThrow();
    expect(failedRunner).toHaveBeenCalledTimes(1);
  });

  it("denial and repeated denial never produce an effect; approve and deny compete atomically", async () => {
    const denied = await request();
    await gates().deny(decision(denied.id));
    await expect(gates().deny(decision(denied.id))).rejects.toThrow();
    await expect(gates().approve(decision(denied.id))).rejects.toThrow();
    expect(await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, denied.id))
      .toMatchObject({ status: "denied", effectRan: false });
    const raced = await request();
    const results = await Promise.allSettled([gates().approve(decision(raced.id)), gates().deny(decision(raced.id))]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const saved = await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, raced.id);
    expect(saved!.effectRan).toBe(saved!.status === "approved");
    expect(noExternalEffect).not.toHaveBeenCalled();
  });

  it("recovers a failed receipt write explicitly and only once across concurrent recovery", async () => {
    const repository = createMongoosePolicyGateRepository();
    const failing = createPolicyGateService({ ...repository,
      completeDryRun: async () => { throw new Error("Injected pre-commit failure"); },
    }, logs(), noExternalEffect);
    const gate = await request();
    await expect(failing.approve(decision(gate.id))).rejects.toThrow();
    expect(await repository.getByTenantAndId(tenantId, gate.id))
      .toMatchObject({ status: "approved", effectRan: false, effectStatus: "failed" });
    await Promise.allSettled(Array.from({ length: 8 }, () => gates().recover(decision(gate.id))));
    expect(await repository.getByTenantAndId(tenantId, gate.id))
      .toMatchObject({ effectRan: true, effectStatus: "succeeded", effectReceipt: { mode: "dry-run" } });
  });

  it("preserves a committed receipt when response delivery fails and recovery is retried", async () => {
    const repository = createMongoosePolicyGateRepository();
    const failing = createPolicyGateService({ ...repository,
      completeDryRun: async (scope, id) => {
        await repository.completeDryRun(scope, id);
        throw new Error("Injected post-commit connection loss");
      },
    }, logs(), noExternalEffect);
    const gate = await request();
    await expect(failing.approve(decision(gate.id))).rejects.toThrow();
    const saved = await repository.getByTenantAndId(tenantId, gate.id);
    expect(saved).toMatchObject({ effectRan: true, effectStatus: "succeeded" });
    await gates().recover(decision(gate.id));
    expect((await repository.getByTenantAndId(tenantId, gate.id))!.effectReceipt).toEqual(saved!.effectReceipt);
  });

  it("enforces authorization and tenant boundaries for approve, deny and recover", async () => {
    const gate = await request();
    for (const action of ["approve", "deny", "recover"]) {
      for (const [actor, expected] of [[null, 401], [{ user: { ...session.user, role: "client" } }, 403],
        [{ user: { ...session.user, tenantId: "another-tenant" } }, 404]] as const) {
        expect((await handleDecidePolicyGate({ session: actor, service: gates(), gateId: gate.id,
          body: { decision: action, actorName: "forged-operator" } })).status).toBe(expected);
      }
    }
    expect(await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, gate.id))
      .toMatchObject({ status: "pending", effectRan: false });
    expect((await gates().list("another-tenant")).some((entry) => entry.id === gate.id)).toBe(false);
    await handleDecidePolicyGate({ session, service: gates(), gateId: gate.id,
      body: { decision: "deny", actorName: "forged-operator" } });
    expect(await createMongoosePolicyGateRepository().getByTenantAndId(tenantId, gate.id))
      .toMatchObject({ decidedBy: `agent-operator:${session.user.id}` });
  });
});

describe.skipIf(!uri || !restartFixture)("MongoDB fresh process recovery", () => {
  it("replays persisted workflow from a fresh process", async () => {
    const fixture = JSON.parse(restartFixture!);
    const address = new URL(uri!);
    if (!["127.0.0.1", "localhost"].includes(address.hostname) || !address.pathname.includes("test")) {
      throw new Error("MONGODB_TEST_URI must select a local test database");
    }
    process.env.MONGODB_URI = uri;
    try {
      await mongoose.connect(uri!, { serverSelectionTimeoutMS: 5000 });
      const before = await getClientPipelineWorkflowRun(fixture.tenantId, fixture.runId);
      const after = await executeClientPipelineWorkflow(fixture);
      expect(before?.status).toBe("completed");
      expect(after.status).toBe("completed");
      expect(after.gates[0].id).toBe(fixture.gateId);
      expect(after.gates[0].effectReceipt).toEqual(fixture.receipt);
      expect(await getPolicyGateModel().countDocuments({ tenantId: fixture.tenantId,
        requestKey: `client-pipeline:${fixture.runId}` })).toBe(1);
      await expect((await getClientService()).updatePipeline(fixture.tenantId, fixture.clientId, {
        pipelineStage: "nurture", leadScore: 45,
      })).rejects.toMatchObject({ name: "ClientWorkflowReservedError" });
    } finally {
      await mongoose.disconnect();
    }
  }, 30_000);
});
