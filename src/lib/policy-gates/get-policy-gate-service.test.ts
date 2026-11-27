import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryPolicyGateRepository } from "./policy-gate-repository";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
const mocks = vi.hoisted(() => ({ repo: vi.fn(), logs: vi.fn(), provider: vi.fn(() => { throw new Error("Provider factory forbidden"); }) }));
vi.mock("@/lib/db/mongodb", () => ({ connectMongo: vi.fn() }));
vi.mock("./mongoose-policy-gate-repository", () => ({ createMongoosePolicyGateRepository: mocks.repo }));
vi.mock("@/lib/agent-action-logs/mongoose-agent-action-log-repository", () => ({ createMongooseAgentActionLogRepository: mocks.logs }));
vi.mock("@/lib/email/get-resend-client", () => ({ getResendClient: mocks.provider }));
vi.mock("@/lib/slack/get-slack-client", () => ({ getSlackClient: mocks.provider }));
vi.mock("@/lib/stripe/get-stripe-client", () => ({ getStripeClient: mocks.provider }));
import { getPolicyGateService } from "./get-policy-gate-service";
describe("foundation-shaped synthetic gate wiring", () => {
  beforeEach(() => vi.clearAllMocks());
  it("approves a persisted dryRun gate without constructing any provider", async () => {
    const repo = createInMemoryPolicyGateRepository();
    mocks.repo.mockReturnValue(repo);
    mocks.logs.mockReturnValue(createInMemoryAgentActionLogRepository());
    const gate = await repo.create({ tenantId: "test", actionType: "client_email", payload: { to: "lead@example.test" }, requestedBy: "test", correlationId: "test", dryRun: true });
    const service = await getPolicyGateService();
    const done = await service.approve({ tenantId: "test", gateId: gate.id, decidedBy: "test", correlationId: "test" });
    expect(done.effectReceipt?.mode).toBe("dry-run");
    expect(done.effectRan).toBe(true);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
});
