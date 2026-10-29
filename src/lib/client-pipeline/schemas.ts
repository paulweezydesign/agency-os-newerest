import { z } from "zod";

// Do not coerce blank strings, null, or booleans to 0. Those values would
// silently disqualify a lead instead of reporting a malformed score.
const leadScoreSchema = z.preprocess(
  (value) =>
    typeof value === "string" && /^[0-9]+$/.test(value.trim())
      ? Number(value.trim())
      : value,
  z.number().int().min(0).max(100),
);

export const runClientPipelineInputSchema = z.object({
  leadScore: leadScoreSchema,
  contactEmail: z.string().trim().email().optional(),
});

export type RunClientPipelineBody = z.infer<typeof runClientPipelineInputSchema>;
