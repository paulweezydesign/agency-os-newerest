import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryResendClient } from "@/lib/email/resend-client";
import {
  createDemoEffectStore,
  createResendAwareEffectRunner,
} from "@/lib/policy-gates/demo-effects";
import { createInMemoryPolicyGateRepository } from "@/lib/policy-gates/policy-gate-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import {
  createClientPipelineService,
  HIGH_LEAD_SCORE,
  MID_LEAD_SCORE,
} from "./client-pipeline-service";

const setup = () => {
  const clients = createClientService(createInMemoryClientRepository());
  const resend = createInMemoryResendClient();
  const effectStore = createDemoEffectStore();
  const policyGates = createPolicyGateService(
    createInMemoryPolicyGateRepository(),
    createInMemoryAgentActionLogRepository(),
    createResendAwareEffectRunner(effectStore, resend),
  );
  const pipeline = createClientPipelineService({ clients, policyGates });
  return { clients, resend, policyGates, pipeline };
};

describe("createClientPipelineService", () => {
  it("branches high scores to onboard and queues gated email without sending", async () => {
    const { clients, resend, policyGates, pipeline } = setup();
    const client = await clients.create({
      tenantId: "t1",
      name: "Acme",
      contactEmail: "lead@acme.test",
    });

    const result = await pipeline.run({
      tenantId: "t1",
      clientId: client.id,
      leadScore: HIGH_LEAD_SCORE,
      requestedBy: "prospector",
      correlationId: "corr-1",
    });

    expect(result.branch).toBe("onboard");
    expect(result.client.pipelineStage).toBe("onboard");
    expect(result.pendingEmailGates).toHaveLength(1);
    expect(result.pendingEmailGates[0]?.status).toBe("pending");
    expect(resend.sendCount()).toBe(0);

    await policyGates.approve({
      tenantId: "t1",
      gateId: result.pendingEmailGates[0]!.id,
      decidedBy: "operator",
      correlationId: "corr-approve",
    });

    expect(resend.sendCount()).toBe(1);
    expect(resend.sent[0]?.to).toBe("lead@acme.test");
  });

  it("branches mid scores to nurture with gated email", async () => {
    const { clients, resend, pipeline } = setup();
    const client = await clients.create({
      tenantId: "t1",
      name: "Beta",
      contactEmail: "hello@beta.test",
    });

    const result = await pipeline.run({
      tenantId: "t1",
      clientId: client.id,
      leadScore: MID_LEAD_SCORE,
      requestedBy: "nurture",
      correlationId: "corr-2",
    });

    expect(result.branch).toBe("nurture");
    expect(result.client.pipelineStage).toBe("nurture");
    expect(result.steps.map((step) => step.agentRole)).toContain("nurture");
    expect(result.pendingEmailGates).toHaveLength(1);
    expect(resend.sendCount()).toBe(0);
  });

  it("disqualifies low scores without email", async () => {
    const { clients, resend, pipeline } = setup();
    const client = await clients.create({
      tenantId: "t1",
      name: "Low",
      contactEmail: "low@example.com",
    });

    const result = await pipeline.run({
      tenantId: "t1",
      clientId: client.id,
      leadScore: MID_LEAD_SCORE - 1,
      requestedBy: "prospector",
      correlationId: "corr-3",
    });

    expect(result.branch).toBe("prospect");
    expect(result.client.pipelineStage).toBe("disqualified");
    expect(result.pendingEmailGates).toHaveLength(0);
    expect(resend.sendCount()).toBe(0);
  });
});
