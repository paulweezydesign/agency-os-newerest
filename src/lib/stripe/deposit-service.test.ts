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
import {
  createDepositService,
  createStripeAwareEffectRunner,
} from "./deposit-service";
import { createInMemoryStripeClient } from "./stripe-client";

const setup = () => {
  const stripe = createInMemoryStripeClient();
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const effectStore = createDemoEffectStore();
  const policyGates = createPolicyGateService(
    createInMemoryPolicyGateRepository(),
    createInMemoryAgentActionLogRepository(),
    createStripeAwareEffectRunner({
      base: createDemoEffectRunner(effectStore),
      stripe,
    }),
  );
  const deposits = createDepositService({ projects, policyGates });
  return { stripe, clients, projects, policyGates, deposits };
};

describe("deposit service", () => {
  it("queues a policy gate without creating checkout until approve", async () => {
    const { clients, projects, deposits, stripe, policyGates } = setup();
    const client = await clients.create({ tenantId: "t1", name: "Acme" });
    const project = await projects.create({
      tenantId: "t1",
      clientId: client.id,
      name: "P",
      budget: 5000,
      timelineStart: "2026-01-01",
      timelineEnd: "2026-06-01",
    });

    const gate = await deposits.requestDeposit({
      tenantId: "t1",
      projectId: project.id,
      amount: 1000,
      requestedBy: "operator",
      correlationId: "c1",
    });

    expect(gate.status).toBe("pending");
    expect(gate.actionType).toBe("invoice_or_deposit");
    expect(stripe.sessions).toHaveLength(0);

    const approved = await policyGates.approve({
      tenantId: "t1",
      gateId: gate.id,
      decidedBy: "operator",
      correlationId: "c2",
    });

    expect(approved.status).toBe("approved");
    expect(stripe.sessions).toHaveLength(1);
    expect(stripe.sessions[0]?.amount).toBe(1000);
  });

  it("records deposit totals from checkout completion", async () => {
    const { clients, projects, deposits } = setup();
    const client = await clients.create({ tenantId: "t1", name: "Acme" });
    const project = await projects.create({
      tenantId: "t1",
      clientId: client.id,
      name: "P",
      budget: 5000,
      timelineStart: "2026-01-01",
      timelineEnd: "2026-06-01",
    });

    const result = await deposits.applyCheckoutCompleted({
      tenantId: "t1",
      projectId: project.id,
      amount: 1000,
      sessionId: "cs_test_1",
    });

    expect(result.depositTotal).toBe(1000);
    const updated = await projects.get("t1", project.id);
    expect(updated?.depositTotal).toBe(1000);
  });
});
