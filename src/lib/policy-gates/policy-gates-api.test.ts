import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import {
  createDemoEffectRunner,
  createDemoEffectStore,
} from "./demo-effects";
import { createInMemoryPolicyGateRepository } from "./policy-gate-repository";
import { createPolicyGateService } from "./policy-gate-service";
import {
  handleDecidePolicyGate,
  handleListPolicyGates,
  handleRequestPolicyGate,
} from "./policy-gates-api";

const operatorSession: AuthSession = {
  user: {
    id: "user-1",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

const adminSession: AuthSession = {
  user: {
    id: "admin-1",
    role: "admin",
    tenantId: "tenant-default",
  },
};

const createService = () => {
  const store = createDemoEffectStore();
  const service = createPolicyGateService(
    createInMemoryPolicyGateRepository(),
    createInMemoryAgentActionLogRepository(),
    createDemoEffectRunner(store),
  );
  return { service, store };
};

describe("handleRequestPolicyGate", () => {
  it("creates a pending client_email gate without running the demo effect", async () => {
    const { service, store } = createService();

    const result = await handleRequestPolicyGate({
      session: operatorSession,
      service,
      body: {
        actionType: "client_email",
        payload: { to: "client@example.com", subject: "Kickoff" },
      },
    });

    expect(result.status).toBe(201);
    if (result.status !== 201) {
      throw new Error("expected created");
    }
    expect(result.body).toMatchObject({
      status: "pending",
      actionType: "client_email",
      tenantId: "tenant-default",
      effectRan: false,
    });
    expect(store.runCount()).toBe(0);
  });

  it("rejects unauthenticated access", async () => {
    const { service } = createService();
    const result = await handleRequestPolicyGate({
      session: null,
      service,
      body: { actionType: "client_email" },
    });
    expect(result).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });
});

describe("handleDecidePolicyGate", () => {
  it("approves and runs the demo effect once", async () => {
    const { service, store } = createService();
    const created = await handleRequestPolicyGate({
      session: operatorSession,
      service,
      body: {
        actionType: "client_email",
        payload: { to: "client@example.com" },
      },
    });
    if (created.status !== 201) {
      throw new Error("expected created");
    }

    const approved = await handleDecidePolicyGate({
      session: adminSession,
      service,
      gateId: created.body.id,
      body: { decision: "approve" },
    });

    expect(approved.status).toBe(200);
    if (approved.status !== 200) {
      throw new Error("expected approved");
    }
    expect(approved.body.status).toBe("approved");
    expect(approved.body.effectRan).toBe(true);
    expect(store.runCount()).toBe(1);
    expect(store.records[0]).toMatchObject({
      actionType: "client_email",
      tenantId: "tenant-default",
    });
  });

  it("denies without running the demo effect", async () => {
    const { service, store } = createService();
    const created = await handleRequestPolicyGate({
      session: operatorSession,
      service,
      body: { actionType: "sow_send", payload: { sowId: "sow-1" } },
    });
    if (created.status !== 201) {
      throw new Error("expected created");
    }

    const denied = await handleDecidePolicyGate({
      session: operatorSession,
      service,
      gateId: created.body.id,
      body: { decision: "deny" },
    });

    expect(denied.status).toBe(200);
    if (denied.status !== 200) {
      throw new Error("expected denied");
    }
    expect(denied.body.status).toBe("denied");
    expect(denied.body.effectRan).toBe(false);
    expect(store.runCount()).toBe(0);
  });

  it("returns 409 when approving a denied gate", async () => {
    const { service, store } = createService();
    const created = await handleRequestPolicyGate({
      session: operatorSession,
      service,
      body: { actionType: "invoice_or_deposit", payload: { amount: 100 } },
    });
    if (created.status !== 201) {
      throw new Error("expected created");
    }

    await handleDecidePolicyGate({
      session: adminSession,
      service,
      gateId: created.body.id,
      body: { decision: "deny" },
    });

    const result = await handleDecidePolicyGate({
      session: adminSession,
      service,
      gateId: created.body.id,
      body: { decision: "approve" },
    });

    expect(result).toEqual({
      status: 409,
      body: { error: "Policy gate already decided" },
    });
    expect(store.runCount()).toBe(0);
  });
});

describe("handleListPolicyGates", () => {
  it("lists pending gates for the operator tenant", async () => {
    const { service } = createService();
    await handleRequestPolicyGate({
      session: operatorSession,
      service,
      body: { actionType: "client_email", payload: { to: "a@example.com" } },
    });

    const other = createPolicyGateService(
      createInMemoryPolicyGateRepository(),
      createInMemoryAgentActionLogRepository(),
      createDemoEffectRunner(createDemoEffectStore()),
    );
    await other.request({
      tenantId: "other-tenant",
      actionType: "client_email",
      payload: {},
      correlationId: "corr-other",
      requestedBy: "other",
    });

    const listed = await handleListPolicyGates({
      session: operatorSession,
      service,
    });

    expect(listed.status).toBe(200);
    if (listed.status !== 200) {
      throw new Error("expected list");
    }
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]?.tenantId).toBe("tenant-default");
  });
});
