import { gateRequestIdentity } from "./request-identity";
import { randomUUID } from "node:crypto";
import type {
  PolicyGate,
  PolicyGateActionType,
  PolicyGateStatus,
} from "./schemas";

export type PolicyGateCreateRecord = {
  tenantId: string;
  actionType: PolicyGateActionType;
  payload: Record<string, unknown>;
  projectId?: string;
  requestedBy: string;
  correlationId: string;
  requestKey?: string;
  workflowRunId?: string;
};

export type PolicyGateDecisionRecord = {
  status: Exclude<PolicyGateStatus, "pending">;
  decidedBy: string;
  effectRan: boolean;
  claimToken?: string;
};

export type PolicyGateRepository = {
  create: (input: PolicyGateCreateRecord) => Promise<PolicyGate>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<PolicyGate | null>;
  listByTenant: (tenantId: string, limit?: number) => Promise<PolicyGate[]>;
  listPendingByTenant: (tenantId: string) => Promise<PolicyGate[]>;
  claim: (
    tenantId: string,
    id: string,
    decidedBy: string,
    claimToken: string,
  ) => Promise<PolicyGate | null>;
  markUncertain: (
    tenantId: string,
    id: string,
    claimToken: string,
  ) => Promise<void>;
  applyDecision: (
    tenantId: string,
    id: string,
    decision: PolicyGateDecisionRecord,
  ) => Promise<PolicyGate | null>;
};

export const createInMemoryPolicyGateRepository = (): PolicyGateRepository => {
  const gates: PolicyGate[] = [];

  return {
    create: async (input) => {
      const identity = gateRequestIdentity(input);
      const previous =
        identity && gates.find((gate) => gate.id === identity.id);
      if (previous) {
        if (previous.requestFingerprint !== identity.requestFingerprint)
          throw new Error("Policy gate request key conflict");
        return structuredClone(previous);
      }
      const gate: PolicyGate = {
        ...identity,
        requestKey: input.requestKey,
        workflowRunId: input.workflowRunId,
        id: identity?.id ?? randomUUID(),
        tenantId: input.tenantId,
        actionType: input.actionType,
        status: "pending",
        payload: input.payload,
        projectId: input.projectId,
        requestedBy: input.requestedBy,
        correlationId: input.correlationId,
        effectRan: false,
        createdAt: new Date().toISOString(),
      };
      gates.push(gate);
      return gate;
    },
    getByTenantAndId: async (tenantId, id) =>
      gates.find((gate) => gate.tenantId === tenantId && gate.id === id) ??
      null,
    listByTenant: async (tenantId, limit = 50) =>
      gates
        .filter((gate) => gate.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    listPendingByTenant: async (tenantId) =>
      gates
        .filter(
          (gate) => gate.tenantId === tenantId && gate.status === "pending",
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    claim: async (tenantId, id, decidedBy, claimToken) => {
      const gate = gates.find(
        (g) =>
          g.tenantId === tenantId &&
          g.id === id &&
          g.status === "pending" &&
          !g.executionState,
      );
      if (!gate) return null;
      Object.assign(gate, {
        executionState: "claimed",
        claimToken,
        decidedBy,
        claimedAt: new Date().toISOString(),
      });
      return structuredClone(gate);
    },
    markUncertain: async (tenantId, id, claimToken) => {
      const gate = gates.find(
        (g) =>
          g.tenantId === tenantId &&
          g.id === id &&
          g.claimToken === claimToken &&
          g.executionState === "claimed",
      );
      if (gate) gate.executionState = "uncertain";
    },
    applyDecision: async (tenantId, id, decision) => {
      const gate = gates.find(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.id === id &&
          entry.status === "pending" &&
          (decision.status === "approved"
            ? entry.executionState === "claimed" &&
              !!decision.claimToken &&
              entry.claimToken === decision.claimToken
            : !entry.executionState),
      );
      if (!gate) {
        return null;
      }

      gate.status = decision.status;
      if (decision.status === "approved") gate.executionState = "completed";
      gate.decidedBy = decision.decidedBy;
      gate.effectRan = decision.effectRan;
      gate.decidedAt = new Date().toISOString();
      return gate;
    },
  };
};
