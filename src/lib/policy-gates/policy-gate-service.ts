import { randomUUID } from "node:crypto";
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
  workflowRunId?: string;
  idempotencyKey?: string;
  correlationId?: string;
}) => Promise<unknown>;

export type PolicyGateService = {
  request: (input: {
    tenantId: string;
    actionType: PolicyGateActionType;
    payload?: Record<string, unknown>;
    projectId?: string;
    requestedBy: string;
    correlationId: string;
    requestKey?: string;
    workflowRunId?: string;
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
    requestKey,
    workflowRunId,
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
      requestKey,
      workflowRunId,
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

    if (!gate.workflowRunId)
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

    if (existing.status !== "pending" || existing.executionState) {
      throw new PolicyGateNotPendingError(
        `Policy gate is already ${existing.status}`,
      );
    }

    const claimToken = randomUUID();
    const claimed = await repository.claim(
      tenantId,
      gateId,
      decidedBy,
      claimToken,
    );
    if (!claimed) throw new PolicyGateNotPendingError();
    let gate: PolicyGate;
    try {
      await runEffect({
        actionType: claimed.actionType,
        payload: claimed.payload,
        projectId: claimed.projectId,
        tenantId,
        workflowRunId: claimed.workflowRunId,
        idempotencyKey: `${tenantId}:${gateId}`,
        correlationId: claimed.correlationId,
      });
      const completed = await repository.applyDecision(tenantId, gateId, {
        status: "approved",
        decidedBy,
        effectRan: true,
        claimToken,
      });
      if (!completed) throw new Error("Approval completion is uncertain");
      gate = completed;
    } catch (error) {
      // A thrown effect or write may have succeeded remotely. Never release the claim.
      await repository
        .markUncertain(tenantId, gateId, claimToken)
        .catch(() => undefined);
      throw error;
    }

    await actionLogs.append({
      tenantId,
      agentName: decidedBy,
      toolName: "policyGates.approve",
      input: { gateId, decisionCorrelationId: correlationId },
      output: { gate },
      status: "success",
      correlationId: gate.workflowRunId ? gate.correlationId : correlationId,
      projectId: gate.projectId,
    });

    if (!gate.workflowRunId)
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

    if (existing.status !== "pending" || existing.executionState) {
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
      input: { gateId, decisionCorrelationId: correlationId },
      output: { gate },
      status: "success",
      correlationId: gate.workflowRunId ? gate.correlationId : correlationId,
      projectId: gate.projectId,
    });

    if (!gate.workflowRunId)
      await notifier?.notifyPolicyGate({
        tenantId,
        event: "denied",
        gate,
        correlationId,
      });

    return gate;
  },
});
