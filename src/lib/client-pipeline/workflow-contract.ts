import { z } from "zod";
import { clientSchema, pipelineStageSchema } from "@/lib/clients/schemas";
import { policyGateSchema } from "@/lib/policy-gates/schemas";

export const workflowInputSchema = z.object({
  tenantId: z.string().min(1).max(200),
  operatorId: z.string().min(1).max(200),
  runId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  correlationId: z.string().min(1).max(200),
  clientId: z.string().regex(/^[a-f\d]{24}$/i),
  leadScore: z.number().int().min(0).max(100),
});

export const pipelineResultSchema = z.object({
  client: clientSchema,
  branch: z.enum(["onboard", "nurture", "prospect"]),
  steps: z.array(z.object({
    stage: pipelineStageSchema,
    agentRole: z.enum(["prospector", "nurture", "onboarding"]),
    note: z.string(),
    emailGateId: z.string().optional(),
  })),
  pendingEmailGates: z.array(policyGateSchema),
});

export const workflowPreparedSchema = z.object({
  input: workflowInputSchema,
  contactEmail: z.string().email(),
  cachedResult: pipelineResultSchema.optional(),
});

export const workflowRoutedSchema = z.object({
  input: workflowInputSchema,
  result: pipelineResultSchema,
});

export const workflowRunSchema = z.object({
  tenantId: z.string(),
  runId: z.string(),
  clientId: z.string(),
  correlationId: z.string(),
  mastraRunId: z.string(),
  status: z.enum(["running", "awaiting_approval", "completed", "failed"]),
  engineState: z.enum(["idle", "running", "suspended", "success", "uncertain"]).optional(),
  checkpoints: z.array(z.string()),
  result: pipelineResultSchema.optional(),
  gates: z.array(policyGateSchema),
  lastErrorCode: z.string().optional(),
});

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type WorkflowPrepared = z.infer<typeof workflowPreparedSchema>;
export type WorkflowRouted = z.infer<typeof workflowRoutedSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;

// The PR30 fake effect is the receipt itself. Approval alone is not completion.
export const gateIsTerminal = (gate: z.infer<typeof policyGateSchema>) =>
  gate.executionState === undefined && (gate.status === "denied" || (gate.status === "approved" && gate.dryRun === true &&
    gate.effectRan && gate.effectStatus === "succeeded" &&
    gate.effectReceipt?.mode === "dry-run" && gate.effectReceipt.key === `policy-gate:${gate.id}`));
