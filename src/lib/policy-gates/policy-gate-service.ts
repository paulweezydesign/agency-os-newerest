import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import type { SlackNotifier } from "@/lib/slack/notify";
import type { PolicyGateRepository } from "./policy-gate-repository";
import {
  historicalGateBlockReason,
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

export class HistoricalPolicyGateError extends Error {
  constructor(message: string) { super(message); this.name = "HistoricalPolicyGateError"; }
}
const assertSupportedGate = (gate: PolicyGate) => {
  const reason = historicalGateBlockReason(gate);
  if (reason) throw new HistoricalPolicyGateError(reason);
};

export class PolicyGateExecutionError extends Error {
  constructor(readonly recoverable: boolean, cause: unknown) {
    super(recoverable ? "Dry-run effect requires explicit recovery" : "Effect outcome requires manual reconciliation", { cause });
    this.name = "PolicyGateExecutionError";
  }
}

export class PolicyGateRequestConflictError extends Error {
  constructor() {
    super("Policy gate request key was already used for different input");
    this.name = "PolicyGateRequestConflictError";
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
    dryRun?: boolean;
    requestKey?: string;
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
  recover: (input: {
    tenantId: string;
    gateId: string;
    decidedBy: string;
    correlationId: string;
  }) => Promise<PolicyGate>;
};

const validateDryRun = (gate: { actionType: PolicyGateActionType; payload: Record<string, unknown> }) => {
  z.literal("client_email").parse(gate.actionType);
  z.email().refine((address) => address.toLowerCase().endsWith(".test"),
    "Dry-run effects require a synthetic .test address").parse(gate.payload.to);
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
    dryRun,
    requestKey,
  }) => {
    const parsed = requestPolicyGateInputSchema.parse({
      actionType,
      payload,
      projectId,
      dryRun,
      requestKey,
    });
    if (!parsed.dryRun && parsed.payload.executionMode === "dry-run") {
      throw new HistoricalPolicyGateError("Synthetic requests must use the explicit dryRun receipt protocol.");
    }
    if (parsed.dryRun) validateDryRun(parsed);

    const gate = await repository.create({
      tenantId,
      actionType: parsed.actionType,
      payload: parsed.payload,
      projectId: parsed.projectId,
      requestedBy,
      correlationId,
      dryRun: parsed.dryRun,
      requestKey: parsed.requestKey,
    });
    if (parsed.requestKey && (gate.actionType !== parsed.actionType ||
      Boolean(gate.dryRun) !== Boolean(parsed.dryRun) ||
      gate.projectId !== parsed.projectId || !isDeepStrictEqual(gate.payload, parsed.payload))) {
      throw new PolicyGateRequestConflictError();
    }

    assertSupportedGate(gate);
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

    if (!gate.dryRun) await notifier?.notifyPolicyGate({
      tenantId,
      event: "requested",
      gate,
      correlationId,
    });

    return gate;
  },
  listPending: (tenantId) => repository.listPendingByTenant(tenantId),
  list: (tenantId, limit) => repository.listByTenant(tenantId, limit),
  approve: async ({ tenantId, gateId, decidedBy, correlationId: decisionCorrelationId }) => {
    decidePolicyGateInputSchema.parse({ decision: "approve" });
    const existing = await repository.getByTenantAndId(tenantId, gateId);

    if (!existing) {
      throw new PolicyGateNotFoundError();
    }
    assertSupportedGate(existing);
    const correlationId = existing.correlationId;

    if (existing.status !== "pending" || existing.executionState !== undefined) {
      throw new PolicyGateNotPendingError(
        `Policy gate is already ${existing.status}`,
      );
    }

    if (existing.dryRun) validateDryRun(existing);
    const claimed = await repository.applyDecision(tenantId, gateId, {
      status: "approved",
      decidedBy,
      effectRan: false,
    });
    if (!claimed) throw new PolicyGateNotPendingError();

    let gate: PolicyGate | null;
    try {
      if (claimed.dryRun) {
        gate = await repository.completeDryRun(tenantId, gateId);
      } else {
        await runEffect({ actionType: claimed.actionType, payload: claimed.payload,
          projectId: claimed.projectId, tenantId });
        gate = await repository.completeEffect(tenantId, gateId);
      }
      // Another explicit dry-run recovery may already have committed the receipt.
      gate ??= await repository.getByTenantAndId(tenantId, gateId);
      if (!gate?.effectRan) throw new Error("Effect completion was not recorded");
    } catch (error) {
      // Generic adapters can fail after remote acceptance. Never automatically retry
      // that ambiguous state. Dry runs have a single atomic, recoverable DB effect.
      await repository.failEffect(tenantId, gateId, claimed.dryRun ? "failed" : "unknown",
        "effect_completion_unconfirmed");
      await actionLogs.append({ tenantId, agentName: decidedBy,
        toolName: "policyGates.approve", input: { gateId, decisionCorrelationId },
        output: { completionUnconfirmed: true, recoverable: Boolean(claimed.dryRun) }, status: "error",
        correlationId, projectId: claimed.projectId });
      throw new PolicyGateExecutionError(Boolean(claimed.dryRun), error);
    }

    await actionLogs.append({
      tenantId,
      agentName: decidedBy,
      toolName: "policyGates.approve",
      input: { gateId, decisionCorrelationId },
      output: { gate },
      status: "success",
      correlationId,
      projectId: gate.projectId,
    });

    if (!gate.dryRun) await notifier?.notifyPolicyGate({
      tenantId,
      event: "approved",
      gate,
      correlationId,
    });

    return gate;
  },
  deny: async ({ tenantId, gateId, decidedBy, correlationId: decisionCorrelationId }) => {
    decidePolicyGateInputSchema.parse({ decision: "deny" });
    const existing = await repository.getByTenantAndId(tenantId, gateId);

    if (!existing) {
      throw new PolicyGateNotFoundError();
    }
    assertSupportedGate(existing);
    const correlationId = existing.correlationId;

    if (existing.status !== "pending" || existing.executionState !== undefined) {
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
      throw new PolicyGateNotPendingError();
    }

    await actionLogs.append({
      tenantId,
      agentName: decidedBy,
      toolName: "policyGates.deny",
      input: { gateId, decisionCorrelationId },
      output: { gate },
      status: "success",
      correlationId,
      projectId: gate.projectId,
    });

    if (!gate.dryRun) await notifier?.notifyPolicyGate({
      tenantId,
      event: "denied",
      gate,
      correlationId,
    });

    return gate;
  },
  recover: async ({ tenantId, gateId, decidedBy, correlationId: decisionCorrelationId }) => {
    const existing = await repository.getByTenantAndId(tenantId, gateId);
    if (!existing) throw new PolicyGateNotFoundError();
    assertSupportedGate(existing);
    const correlationId = existing.correlationId;
    if (!existing.dryRun || existing.status !== "approved" || existing.executionState !== undefined) {
      throw new PolicyGateNotPendingError("Only an approved dry-run effect can be recovered");
    }
    validateDryRun(existing);
    try {
      const gate = existing.effectRan ? existing :
        await repository.completeDryRun(tenantId, gateId)
          ?? await repository.getByTenantAndId(tenantId, gateId);
      if (!gate?.effectRan) throw new Error("Dry-run completion was not recorded");
      await actionLogs.append({ tenantId, agentName: decidedBy,
        toolName: "policyGates.recover", input: { gateId, decisionCorrelationId }, output: { gate },
        status: "success", correlationId, projectId: gate.projectId });
      return gate;
    } catch (error) {
      await repository.failEffect(tenantId, gateId, "failed", "effect_completion_unconfirmed");
      throw new PolicyGateExecutionError(true, error);
    }
  },
});
