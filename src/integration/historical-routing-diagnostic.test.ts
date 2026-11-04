import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ provider: vi.fn(() => { throw new Error("DIAGNOSTIC_PROVIDER_FACTORY_REACHED"); }) }));
vi.mock("@/lib/email/get-resend-client", () => ({ getResendClient: mock.provider }));
vi.mock("@/lib/stripe/get-stripe-client", () => ({ getStripeClient: mock.provider }));
vi.mock("@/lib/slack/get-slack-client", () => ({ getSlackClient: mock.provider }));
import { getPolicyGateModel } from "@/lib/policy-gates/policy-gate-model";
import { createMongoosePolicyGateRepository } from "@/lib/policy-gates/mongoose-policy-gate-repository";
import { handleDecidePolicyGate } from "@/lib/policy-gates/policy-gates-api";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
const uri = process.env.MONGODB_TEST_URI;
describe.skipIf(!uri)("historical persisted gate routing diagnostic", () => {
  beforeAll(async () => {
    const url = new URL(uri!);
    if (url.hostname !== "127.0.0.1" || !url.pathname.includes("test")) throw new Error("Local test database required");
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri!);
  });
  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => { await mongoose.disconnect(); });
  it.each(["payload", "workflowRunId", "both"])("keeps historical %s dry run out of provider construction", async (shape) => {
    const tenantId = `diagnostic-${randomUUID()}`;
    const inserted = await getPolicyGateModel().collection.insertOne({
      tenantId, actionType: "client_email", status: "pending", effectRan: false,
      payload: { to: "historical@example.test", ...(shape !== "workflowRunId" ? { executionMode: "dry-run" } : {}) },
      ...(shape !== "payload" ? { workflowRunId: `historical-${randomUUID()}` } : {}),
      requestedBy: "synthetic-test", correlationId: "synthetic-test", createdAt: new Date(),
    });
    const service = await getPolicyGateService();
    const decision = { tenantId, gateId: inserted.insertedId.toString(), decidedBy: "synthetic-test", correlationId: "synthetic-test" };
    for (const operation of ["approve", "deny", "recover"] as const) {
      const response = await handleDecidePolicyGate({ session: { user: { id: "operator", tenantId, role: "agent-operator" } }, service, gateId: decision.gateId, body: { decision: operation } });
      expect(response).toMatchObject({ status: 409, body: { error: expect.stringContaining("undecided") } });
    }
    // Repository-level CAS also rejects the unsupported shape if reached directly.
    expect(await createMongoosePolicyGateRepository().applyDecision(tenantId, decision.gateId, { status: "approved", decidedBy: "test", effectRan: false })).toBeNull();
    const stored = await getPolicyGateModel().collection.findOne({ _id: inserted.insertedId });
    console.log(JSON.stringify({ shape, providerFactoryCalls: mock.provider.mock.calls.length, status: stored?.status, effectStatus: stored?.effectStatus, effectRan: stored?.effectRan, receiptPresent: Boolean(stored?.effectReceipt) }));
    expect(mock.provider).not.toHaveBeenCalled();
    expect(stored).toMatchObject({ status: "pending", effectRan: false });
    expect(stored?.effectReceipt).toBeUndefined();
  });
  it.each(["claimed", "uncertain", "unknown"])("keeps historical %s outcome blocked without provider construction", async (state) => {
    const tenantId = `ambiguous-${randomUUID()}`;
    const inserted = await getPolicyGateModel().collection.insertOne({
      tenantId, actionType: "client_email", status: state === "unknown" ? "approved" : "pending", effectRan: false,
      payload: { to: "historical@example.test", executionMode: "dry-run" }, workflowRunId: "historical-run",
      ...(state === "unknown" ? { effectStatus: "unknown" } : { executionState: state }),
      requestedBy: "test", correlationId: "test", createdAt: new Date(),
    });
    const service = await getPolicyGateService();
    for (const operation of ["approve", "deny", "recover"] as const) {
      const response = await handleDecidePolicyGate({ session: { user: { id: "operator", tenantId, role: "agent-operator" } }, service, gateId: inserted.insertedId.toString(), body: { decision: operation } });
      expect(response).toMatchObject({ status: 409, body: { error: expect.stringContaining("reconciliation") } });
    }
    expect(mock.provider).not.toHaveBeenCalled();
    const stored = await getPolicyGateModel().collection.findOne({ _id: inserted.insertedId });
    expect(stored?.effectRan).toBe(false); expect(stored?.effectReceipt).toBeUndefined();
  });
  it("retains explicit foundation receipt behavior even with legacy metadata", async () => {
    const tenantId = `foundation-${randomUUID()}`;
    const inserted = await getPolicyGateModel().collection.insertOne({
      tenantId, actionType: "client_email", status: "pending", effectRan: false, dryRun: true,
      payload: { to: "foundation@example.test", executionMode: "dry-run" }, workflowRunId: "metadata",
      requestedBy: "test", correlationId: "test", createdAt: new Date(),
    });
    const service = await getPolicyGateService();
    const decision = { tenantId, gateId: inserted.insertedId.toString(), decidedBy: "test", correlationId: "test" };
    const approved = await service.approve(decision);
    expect(approved.effectReceipt).toMatchObject({ key: `policy-gate:${decision.gateId}`, mode: "dry-run" });
    expect((await service.recover(decision)).effectReceipt).toEqual(approved.effectReceipt);
    expect(mock.provider).not.toHaveBeenCalled();
  });

});
