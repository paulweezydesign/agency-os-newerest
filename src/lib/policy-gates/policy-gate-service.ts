import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { SlackNotifier } from "@/lib/slack/notify";
import type { PolicyGateRepository } from "./policy-gate-repository";
import {
  decidePolicyGateInputSchema,
  requestPolicyGateInputSchema,
  type PolicyGate,
  type PolicyGateActionType,
} from "./schemas";

export class PolicyGateNotFoundError extends Error {
  constructor(message = "Policy gate not found for tenant") {
    super(message);
    this.name = "PolicyGateNotFoundError";
  }
}

export class PolicyGateNotPendingError extends Error {
  constructor(message = "Policy gate is not pending") {
    super(message);
    this.name = "PolicyGateNotPendingError";
  }
}

export type PolicyGateEffectRunner = (input: {
  actionType: PolicyGateActionType;
  payload: Record<string, unknown>;
  projectId?: string;
  tenantId: string;
}) => Promise<unknown>;

export type PolicyGateService = {
  request: (input: {
    tenantId: string;
    actionType: PolicyGateActionType;
    payload?: Record<string, unknown>;
    projectId?: string;
    requestedBy: string;
    correlationId: string;
  }) => Promise<PolicyGate>;
  listPending: (tenantId: string) => Promise<PolicyGate[]>;
  list: (tenantId: string, limit?: number) => Promise<PolicyGate[]>;
  approve: (input: {
    tenantId: string;
    gateId: string;
    decidedBy: string;
    correlationId: string;
  }) => Promise<PolicyGate>;
  deny: (input: {
    tenantId: string;
    gateId: string;
    decidedBy: string;
    correlationId: string;
  }) => Promise<PolicyGate>;
};

export const createPolicyGateService = (
  repository: PolicyGateRepository,
  actionLogs: AgentActionLogRepository,
  runEffect: PolicyGateEffectRunner,
  notifier?: Pick<SlackNotifier, "notifyPolicyGate">,
): PolicyGateService => ({
  request: async ({
    tenantId,
    actionType,
    payload = {},
    projectId,
    requestedBy,
    correlationId,
  }) => {
    const parsed = requestPolicyGateInputSchema.parse({
      actionType,
      payload,
      projectId,
    });

    const gate = await repository.create({
      tenantId,
      actionType: parsed.actionType,
      payload: parsed.payload,
      projectId: parsed.projectId,
      requestedBy,
      correlationId,
    });

    await actionLogs.append({
      tenantId,
      agentName: requestedBy,
      toolName: "policyGates.request",
      input: {
        actionType: parsed.actionType,
        payload: parsed.payload,
        projectId: parsed.projectId,
      },
      output: { gate },
      status: "success",
      correlationId,
      projectId: parsed.projectId,
    });

    await notifier?.notifyPolicyGate({
      tenantId,
      event: "requested",
      gate,
      correlationId,
    });

    return gate;
  },
  listPending: (tenantId) => repository.listPendingByTenant(tenantId),
  list: (tenantId, limit) => repository.listByTenant(tenantId, limit),
  approve: async ({ tenantId, gateId, decidedBy, correlationId }) => {
    decidePolicyGateInputSchema.parse({ decision: "approve" });
    const existing = await repository.getByTenantAndId(tenantId, gateId);

    if (!existing) {
      throw new PolicyGateNotFoundError();
    }

    if (existing.status !== "pending") {
      throw new PolicyGateNotPendingError(
        `Policy gate is already ${existing.status}`,
      );
    }

    await runEffect({
      actionType: existing.actionType,
      payload: existing.payload,
      projectId: existing.projectId,
      tenantId,
    });

    const gate = await repository.applyDecision(tenantId, gateId, {
      status: "approved",
      decidedBy,
      effectRan: true,
    });

    if (!gate) {
      throw new PolicyGateNotFoundError();
    }

    await actionLogs.append({
      tenantId,
      agentName: decidedBy,
      toolName: "policyGates.approve",
      input: { gateId },
      output: { gate },
      status: "success",
      correlationId,
      projectId: gate.projectId,
    });

    await notifier?.notifyPolicyGate({
      tenantId,
      event: "approved",
      gate,
      correlationId,
    });

    return gate;
  },
  deny: async ({ tenantId, gateId, decidedBy, correlationId }) => {
    decidePolicyGateInputSchema.parse({ decision: "deny" });
    const existing = await repository.getByTenantAndId(tenantId, gateId);

    if (!existing) {
      throw new PolicyGateNotFoundError();
    }

    if (existing.status !== "pending") {
      throw new PolicyGateNotPendingError(
        `Policy gate is already ${existing.status}`,
      );
    }

    const gate = await repository.applyDecision(tenantId, gateId, {
      status: "denied",
      decidedBy,
      effectRan: false,
    });

    if (!gate) {
      throw new PolicyGateNotFoundError();
    }

    await actionLogs.append({
      tenantId,
      agentName: decidedBy,
      toolName: "policyGates.deny",
      input: { gateId },
      output: { gate },
      status: "success",
      correlationId,
      projectId: gate.projectId,
    });

    await notifier?.notifyPolicyGate({
      tenantId,
      event: "denied",
      gate,
      correlationId,
    });

    return gate;
  },
});
