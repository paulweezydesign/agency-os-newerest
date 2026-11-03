import { it, expect, vi } from "vitest";
import { createInMemoryPolicyGateRepository } from "./policy-gate-repository";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { getPolicyGateService } from "./get-policy-gate-service";
import { getResendClient } from "@/lib/email/get-resend-client";
import { getStripeClient } from "@/lib/stripe/get-stripe-client";
import { getSlackClient } from "@/lib/slack/get-slack-client";
vi.mock("@/lib/db/mongodb", () => ({
  connectMongo: async () => ({ ready: true }),
}));
vi.mock("./mongoose-policy-gate-repository", () => ({
  createMongoosePolicyGateRepository: () =>
    createInMemoryPolicyGateRepository(),
}));
vi.mock("@/lib/agent-action-logs/mongoose-agent-action-log-repository", () => ({
  createMongooseAgentActionLogRepository: () =>
    createInMemoryAgentActionLogRepository(),
}));
vi.mock("@/lib/email/get-resend-client", () => ({
  getResendClient: vi.fn(() => {
    throw new Error("provider forbidden");
  }),
}));
vi.mock("@/lib/stripe/get-stripe-client", () => ({
  getStripeClient: vi.fn(() => {
    throw new Error("provider forbidden");
  }),
}));
vi.mock("@/lib/slack/get-slack-client", () => ({
  getSlackClient: vi.fn(() => {
    throw new Error("provider forbidden");
  }),
}));
it("production approval wiring bypasses all provider factories for workflow gates", async () => {
  const service = await getPolicyGateService();
  const gate = await service.request({
    tenantId: "test",
    actionType: "client_email",
    payload: { to: "lead@example.test" },
    requestedBy: "operator",
    correlationId: "run",
    workflowRunId: "run",
  });
  const approved = await service.approve({
    tenantId: "test",
    gateId: gate.id,
    decidedBy: "operator",
    correlationId: "decision",
  });
  expect(approved).toMatchObject({
    status: "approved",
    executionState: "completed",
  });
  expect(getResendClient).not.toHaveBeenCalled();
  expect(getStripeClient).not.toHaveBeenCalled();
  expect(getSlackClient).not.toHaveBeenCalled();
});
