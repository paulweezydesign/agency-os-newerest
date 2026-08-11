import { z } from "zod";

export const changeRequestStatusSchema = z.enum([
  "draft",
  "pending_agency",
  "pending_client",
  "approved",
  "rejected",
]);

export const createChangeRequestInputSchema = z.object({
  title: z.string().trim().min(1),
  scopeImpact: z.string().trim().min(1),
  timelineImpact: z.string().trim().min(1),
  budgetImpact: z.coerce.number(),
});

export const decideChangeRequestInputSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export const changeRequestSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  scopeImpact: z.string().min(1),
  timelineImpact: z.string().min(1),
  budgetImpact: z.number(),
  status: changeRequestStatusSchema,
  createdBy: z.string().min(1),
  createdByRole: z.enum(["agency", "client"]),
  agencyApprovedBy: z.string().optional(),
  clientApprovedBy: z.string().optional(),
  createdAt: z.string().min(1),
  decidedAt: z.string().optional(),
});

export type ChangeRequestStatus = z.infer<typeof changeRequestStatusSchema>;
export type CreateChangeRequestInput = z.infer<
  typeof createChangeRequestInputSchema
>;
export type DecideChangeRequestInput = z.infer<
  typeof decideChangeRequestInputSchema
>;
export type ChangeRequest = z.infer<typeof changeRequestSchema>;
