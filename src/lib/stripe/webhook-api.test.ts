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
import { createDepositService } from "./deposit-service";
import { createInMemoryStripeClient } from "./stripe-client";
import { handleStripeWebhook } from "./webhook-api";

describe("handleStripeWebhook", () => {
  it("accepts a signed checkout.session.completed event", async () => {
    const stripe = createInMemoryStripeClient("whsec_test");
    const clients = createClientService(createInMemoryClientRepository());
    const projects = createProjectService(
      createInMemoryProjectRepository(),
      clients,
      createInMemoryBudgetAlertRepository(),
    );
    const policyGates = createPolicyGateService(
      createInMemoryPolicyGateRepository(),
      createInMemoryAgentActionLogRepository(),
      createDemoEffectRunner(createDemoEffectStore()),
    );
    const deposits = createDepositService({ projects, policyGates });
    const client = await clients.create({ tenantId: "t1", name: "Acme" });
    const project = await projects.create({
      tenantId: "t1",
      clientId: client.id,
      name: "P",
      budget: 1000,
      timelineStart: "2026-01-01",
      timelineEnd: "2026-02-01",
    });

    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          amount_total: 250,
          currency: "usd",
          metadata: { projectId: project.id, tenantId: "t1" },
        },
      },
    });

    const result = await handleStripeWebhook({
      stripe,
      deposits,
      payload,
      signature: "whsec_test",
    });

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.depositTotal).toBe(250);
    }
  });

  it("rejects invalid signatures", async () => {
    const stripe = createInMemoryStripeClient("whsec_test");
    const clients = createClientService(createInMemoryClientRepository());
    const projects = createProjectService(
      createInMemoryProjectRepository(),
      clients,
      createInMemoryBudgetAlertRepository(),
    );
    const deposits = createDepositService({
      projects,
      policyGates: createPolicyGateService(
        createInMemoryPolicyGateRepository(),
        createInMemoryAgentActionLogRepository(),
        createDemoEffectRunner(createDemoEffectStore()),
      ),
    });

    const result = await handleStripeWebhook({
      stripe,
      deposits,
      payload: "{}",
      signature: "bad",
    });

    expect(result.status).toBe(400);
  });
});
