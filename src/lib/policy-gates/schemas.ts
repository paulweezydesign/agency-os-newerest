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
  createdAt: z.string().min(1),
  decidedAt: z.string().optional(),
});

export const requestPolicyGateInputSchema = z.object({
  actionType: policyGateActionTypeSchema,
  payload: policyGatePayloadSchema.default({}),
  projectId: z.string().min(1).optional(),
});

export const decidePolicyGateInputSchema = z.object({
  decision: z.enum(["approve", "deny"]),
});

export type PolicyGateActionType = z.infer<typeof policyGateActionTypeSchema>;
export type PolicyGateStatus = z.infer<typeof policyGateStatusSchema>;
export type PolicyGate = z.infer<typeof policyGateSchema>;
export type RequestPolicyGateInput = z.infer<
  typeof requestPolicyGateInputSchema
>;
export type DecidePolicyGateInput = z.infer<typeof decidePolicyGateInputSchema>;
