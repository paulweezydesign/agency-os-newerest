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
  dryRun?: boolean;
  requestKey?: string;
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
  completeDryRun: (tenantId: string, id: string) => Promise<PolicyGate | null>;
  completeEffect: (tenantId: string, id: string) => Promise<PolicyGate | null>;
  failEffect: (tenantId: string, id: string, status: "failed" | "unknown", errorCode: string) => Promise<void>;
};

export const createInMemoryPolicyGateRepository = (): PolicyGateRepository => {
  const gates: PolicyGate[] = [];

  return {
    create: async (input) => {
      const existing = input.requestKey && gates.find((gate) =>
        gate.tenantId === input.tenantId && gate.requestKey === input.requestKey);
      if (existing) return structuredClone(existing);
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
        dryRun: input.dryRun ?? false,
        requestKey: input.requestKey,
        effectStatus: "idle",
        createdAt: new Date().toISOString(),
      };
      gates.push(gate);
      return structuredClone(gate);
    },
    getByTenantAndId: async (tenantId, id) =>
      structuredClone(gates.find((gate) => gate.tenantId === tenantId && gate.id === id) ?? null),
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
        (entry) => entry.tenantId === tenantId && entry.id === id && entry.status === "pending",
      );
      if (!gate) {
        return null;
      }

      gate.status = decision.status;
      gate.decidedBy = decision.decidedBy;
      gate.effectRan = decision.effectRan;
      gate.effectStatus = decision.status === "approved" ? "running" : "idle";
      gate.decidedAt = new Date().toISOString();
      return structuredClone(gate);
    },
    completeDryRun: async (tenantId, id) => {
      const gate = gates.find((entry) => entry.tenantId === tenantId && entry.id === id &&
        entry.status === "approved" && entry.dryRun && !entry.effectRan);
      if (!gate) return null;
      gate.effectReceipt = { key: `policy-gate:${id}`, mode: "dry-run", recordedAt: new Date().toISOString() };
      gate.effectRan = true;
      gate.effectStatus = "succeeded";
      delete gate.effectError;
      return structuredClone(gate);
    },
    completeEffect: async (tenantId, id) => {
      const gate = gates.find((entry) => entry.tenantId === tenantId && entry.id === id &&
        entry.status === "approved" && entry.effectStatus === "running" && !entry.effectRan);
      if (!gate) return null;
      gate.effectRan = true;
      gate.effectStatus = "succeeded";
      return structuredClone(gate);
    },
    failEffect: async (tenantId, id, status, errorCode) => {
      const gate = gates.find((entry) => entry.tenantId === tenantId && entry.id === id &&
        entry.status === "approved" && !entry.effectRan);
      if (gate) { gate.effectStatus = status; gate.effectError = errorCode; }
    },
  };
};
