import { z } from "zod";

export const pipelineStageSchema = z.enum([
  "lead",
  "prospect",
  "qualify",
  "nurture",
  "onboard",
  "disqualified",
]);

export const createClientInputSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  contactEmail: z.string().trim().email().optional(),
});

export const updateClientPipelineInputSchema = z.object({
  pipelineStage: pipelineStageSchema,
  leadScore: z.number().int().min(0).max(100),
  contactEmail: z.string().trim().email().optional(),
});

export const clientSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  contactEmail: z.string().email().optional(),
  pipelineStage: pipelineStageSchema,
  leadScore: z.number().int().min(0).max(100),
  createdAt: z.string().min(1),
});

export type PipelineStage = z.infer<typeof pipelineStageSchema>;
export type CreateClientInput = z.infer<typeof createClientInputSchema>;
export type UpdateClientPipelineInput = z.infer<
  typeof updateClientPipelineInputSchema
>;
export type Client = z.infer<typeof clientSchema>;

export const DEFAULT_PIPELINE_STAGE: PipelineStage = "lead";
export const DEFAULT_LEAD_SCORE = 0;
