import { z } from "zod";

export const policyGateActionTypeSchema = z.enum([
  "client_email",
  "sow_send",
  "invoice_or_deposit",
]);

export const policyGateStatusSchema = z.enum([
  "pending",
  "approved",
  "denied",
]);

export const policyGatePayloadSchema = z.record(z.string(), z.unknown());

export const policyGateSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  actionType: policyGateActionTypeSchema,
  status: policyGateStatusSchema,
  payload: policyGatePayloadSchema,
  projectId: z.string().optional(),
  requestedBy: z.string().min(1),
  decidedBy: z.string().optional(),
  correlationId: z.string().min(1),
  effectRan: z.boolean(),
  workflowRunId: z.string().optional(),
  executionState: z.enum(["claimed", "uncertain", "completed"]).optional(),
  dryRun: z.boolean().optional(),
  requestKey: z.string().min(1).optional(),
  effectStatus: z.enum(["idle", "running", "succeeded", "failed", "unknown"]).optional(),
  effectError: z.string().optional(),
  effectReceipt: z.object({
    key: z.string(),
    mode: z.literal("dry-run"),
    recordedAt: z.string(),
  }).optional(),
  createdAt: z.string().min(1),
  decidedAt: z.string().optional(),
});

export const requestPolicyGateInputSchema = z.object({
  actionType: policyGateActionTypeSchema,
  payload: policyGatePayloadSchema.default({}),
  projectId: z.string().min(1).optional(),
  dryRun: z.boolean().optional(),
  requestKey: z.string().min(1).optional(),
});

export const decidePolicyGateInputSchema = z.object({
  decision: z.enum(["approve", "deny", "recover"]),
});

export type PolicyGateActionType = z.infer<typeof policyGateActionTypeSchema>;
export type PolicyGateStatus = z.infer<typeof policyGateStatusSchema>;
export type PolicyGate = z.infer<typeof policyGateSchema>;
export type RequestPolicyGateInput = z.infer<
  typeof requestPolicyGateInputSchema
>;
export type DecidePolicyGateInput = z.infer<typeof decidePolicyGateInputSchema>;

/** Historical markers are evidence to block generic effects, not authority to
 * migrate an old gate into the foundation receipt protocol. */
export const historicalGateBlockReason = (gate: Pick<PolicyGate, "dryRun" | "workflowRunId" | "executionState" | "payload" | "status" | "effectRan" | "effectStatus">): string | null => {
  if (gate.executionState !== undefined) return "Historical execution requires reconciliation; no decision or effect was performed.";
  if (!gate.dryRun && (gate.workflowRunId !== undefined || gate.payload.executionMode === "dry-run")) {
    return gate.status === "pending" && !gate.effectRan && (!gate.effectStatus || gate.effectStatus === "idle")
      ? "Historical synthetic gate is undecided; format review is required before a decision. No effect was performed."
      : "Historical synthetic outcome requires reconciliation; no decision or effect was performed.";
  }
  return null;
};
