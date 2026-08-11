import { z } from "zod";

export const runClientPipelineInputSchema = z.object({
  leadScore: z.coerce.number().int().min(0).max(100),
  contactEmail: z.string().trim().email().optional(),
});

export type RunClientPipelineBody = z.infer<typeof runClientPipelineInputSchema>;
