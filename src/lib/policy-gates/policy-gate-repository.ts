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
};

export type PolicyGateDecisionRecord = {
  status: Exclude<PolicyGateStatus, "pending">;
  decidedBy: string;
  effectRan: boolean;
};

export type PolicyGateRepository = {
  create: (input: PolicyGateCreateRecord) => Promise<PolicyGate>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<PolicyGate | null>;
  listByTenant: (tenantId: string, limit?: number) => Promise<PolicyGate[]>;
  listPendingByTenant: (tenantId: string) => Promise<PolicyGate[]>;
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
      const gate: PolicyGate = {
        id: randomUUID(),
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
    applyDecision: async (tenantId, id, decision) => {
      const gate = gates.find(
        (entry) => entry.tenantId === tenantId && entry.id === id,
      );
      if (!gate) {
        return null;
      }

      gate.status = decision.status;
      gate.decidedBy = decision.decidedBy;
      gate.effectRan = decision.effectRan;
      gate.decidedAt = new Date().toISOString();
      return gate;
    },
  };
};
