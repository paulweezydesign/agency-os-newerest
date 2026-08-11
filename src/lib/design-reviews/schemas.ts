import { z } from "zod";

export const designReviewStatusSchema = z.enum([
  "pending",
  "annotated",
  "approved",
  "rejected",
]);

export const createDesignReviewInputSchema = z.object({
  title: z.string().trim().min(1),
  assetUrl: z.string().trim().url(),
  notes: z.string().trim().optional(),
});

export const annotateDesignReviewInputSchema = z.object({
  annotation: z.string().trim().min(1),
});

export const decideDesignReviewInputSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  annotation: z.string().trim().optional(),
});

export const designReviewSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  assetUrl: z.string().url(),
  notes: z.string().optional(),
  annotation: z.string().optional(),
  status: designReviewStatusSchema,
  decidedBy: z.string().optional(),
  createdAt: z.string().min(1),
  decidedAt: z.string().optional(),
});

export type DesignReviewStatus = z.infer<typeof designReviewStatusSchema>;
export type CreateDesignReviewInput = z.infer<
  typeof createDesignReviewInputSchema
>;
export type AnnotateDesignReviewInput = z.infer<
  typeof annotateDesignReviewInputSchema
>;
export type DecideDesignReviewInput = z.infer<
  typeof decideDesignReviewInputSchema
>;
export type DesignReview = z.infer<typeof designReviewSchema>;
