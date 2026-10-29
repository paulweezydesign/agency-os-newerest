import { describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { handleCreateClient } from "@/lib/clients/clients-api";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryPolicyGateRepository } from "@/lib/policy-gates/policy-gate-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import { handleRunClientPipeline } from "./client-pipeline-api";
import { createClientPipelineService } from "./client-pipeline-service";

const operator: AuthSession = {
  user: { id: "operator-1", role: "agent-operator", tenantId: "tenant-a" },
};

const makeFixture = () => {
  const clients = createClientService(createInMemoryClientRepository());
  const actionLogs = createInMemoryAgentActionLogRepository();
  // No external integrations: only record if an effect was incorrectly run.
  const runEffect = vi.fn(async () => ({ dryRun: true }));
  const policyGates = createPolicyGateService(
    createInMemoryPolicyGateRepository(),
    actionLogs,
    runEffect,
  );
  const pipeline = createClientPipelineService({ clients, policyGates });
  return { clients, actionLogs, policyGates, pipeline, runEffect };
};

describe("lead intake to policy-gated onboarding contract (Issue #27)", () => {
  it("persists a submitted contact email, queues nurture, and denies without sending", async () => {
    const { clients, actionLogs, policyGates, pipeline, runEffect } = makeFixture();
    const created = await handleCreateClient({
      session: operator,
      service: clients,
      body: { name: "Example Test Agency", contactEmail: " contact@example.test " },
    });

    expect(created.status).toBe(201);
    if (created.status !== 201) throw new Error("Expected a created client");
    expect((await clients.get("tenant-a", created.body.id))?.contactEmail)
      .toBe("contact@example.test");

    const run = await handleRunClientPipeline({
      session: operator,
      service: pipeline,
      clientId: created.body.id,
      body: { leadScore: "45" },
    });

    expect(run.status).toBe(200);
    if (run.status !== 200) throw new Error("Expected a scored client");
    expect(run.body.branch).toBe("nurture");
    expect(run.body.client.pipelineStage).toBe("nurture");
    expect(run.body.pendingEmailGates).toHaveLength(1);

    const pendingGate = run.body.pendingEmailGates[0]!;
    expect(pendingGate).toMatchObject({
      tenantId: "tenant-a",
      status: "pending",
      actionType: "client_email",
      effectRan: false,
    });
    expect(pendingGate.payload.to).toBe("contact@example.test");
    expect(runEffect).not.toHaveBeenCalled();

    const requested = await actionLogs.listByCorrelationId(
      "tenant-a", pendingGate.correlationId,
    );
    expect(requested).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toolName: "policyGates.request",
        status: "success",
      }),
    ]));

    const denied = await policyGates.deny({
      tenantId: "tenant-a",
      gateId: pendingGate.id,
      decidedBy: "operator-1",
      correlationId: "deny-1",
    });
    expect(denied).toMatchObject({ status: "denied", effectRan: false });
    expect(runEffect).not.toHaveBeenCalled();

    const denyLogs = await actionLogs.listByCorrelationId("tenant-a", "deny-1");
    expect(denyLogs[0]?.toolName).toBe("policyGates.deny");
    await expect(policyGates.approve({
      tenantId: "tenant-a",
      gateId: pendingGate.id,
      decidedBy: "operator-1",
      correlationId: "invalid-after-deny",
    })).rejects.toThrow(/not pending|already denied/i);
    expect(runEffect).not.toHaveBeenCalled();
  });

  it.each([
    { score: 39, branch: "prospect", stage: "disqualified", gateCount: 0 },
    { score: 40, branch: "nurture", stage: "nurture", gateCount: 1 },
    { score: 69, branch: "nurture", stage: "nurture", gateCount: 1 },
    { score: 70, branch: "onboard", stage: "onboard", gateCount: 1 },
  ])("routes score $score to $stage without outbound effects", async ({
    score, branch, stage, gateCount,
  }) => {
    const { clients, pipeline, runEffect } = makeFixture();
    const client = await clients.create({
      tenantId: "tenant-a",
      name: "Synthetic Lead",
      contactEmail: "lead@example.test",
    });
    const result = await handleRunClientPipeline({
      session: operator,
      service: pipeline,
      clientId: client.id,
      body: { leadScore: score },
    });

    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error("Expected a pipeline run");
    expect(result.body.branch).toBe(branch);
    expect(result.body.client.pipelineStage).toBe(stage);
    expect(result.body.pendingEmailGates).toHaveLength(gateCount);
    expect(result.body.client.leadScore).toBe(score);
    expect(runEffect).not.toHaveBeenCalled();
  });

  it("does not queue an email without a contact address", async () => {
    const { clients, pipeline, runEffect } = makeFixture();
    const client = await clients.create({ tenantId: "tenant-a", name: "No Contact" });
    const result = await handleRunClientPipeline({
      session: operator, service: pipeline, clientId: client.id,
      body: { leadScore: 70 },
    });
    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error("Expected a pipeline run");
    expect(result.body.client.pipelineStage).toBe("onboard");
    expect(result.body.pendingEmailGates).toHaveLength(0);
    expect(runEffect).not.toHaveBeenCalled();
  });

  it.each([null, "", "   ", "not-a-score", true, -1, 101, 40.5])(
    "rejects invalid score %s before changing data",
    async (score) => {
      const { clients, pipeline, policyGates, runEffect } = makeFixture();
      const client = await clients.create({
        tenantId: "tenant-a", name: "Needs Valid Score",
      });
      const result = await handleRunClientPipeline({
        session: operator, service: pipeline, clientId: client.id,
        body: { leadScore: score },
      });
      expect(result).toEqual({
        status: 400, body: { error: "Invalid request" },
      });
      expect((await clients.get("tenant-a", client.id))?.pipelineStage).toBe("lead");
      expect(await policyGates.listPending("tenant-a")).toHaveLength(0);
      expect(runEffect).not.toHaveBeenCalled();
    },
  );

  it("rejects anonymous, client-role, and cross-tenant pipeline requests", async () => {
    const { clients, pipeline, policyGates, runEffect } = makeFixture();
    const client = await clients.create({
      tenantId: "tenant-a", name: "Private Lead",
    });
    const input = { service: pipeline, clientId: client.id, body: { leadScore: 70 } };
    const anonymous = await handleRunClientPipeline({ ...input, session: null });
    expect(anonymous.status).toBe(401);

    const clientRole: AuthSession = {
      user: { id: "client-1", role: "client", tenantId: "tenant-a" },
    };
    const forbidden = await handleRunClientPipeline({ ...input, session: clientRole });
    expect(forbidden.status).toBe(403);

    const otherTenant: AuthSession = {
      user: { id: "operator-2", role: "agent-operator", tenantId: "tenant-b" },
    };
    const isolated = await handleRunClientPipeline({ ...input, session: otherTenant });
    expect(isolated.status).toBe(404);
    expect((await clients.get("tenant-a", client.id))?.pipelineStage).toBe("lead");
    expect(await policyGates.listPending("tenant-a")).toHaveLength(0);
    expect(runEffect).not.toHaveBeenCalled();
  });
});
