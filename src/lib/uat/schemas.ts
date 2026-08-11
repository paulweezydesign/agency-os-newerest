import { z } from "zod";

export const uatItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  completed: z.boolean(),
  completedBy: z.string().optional(),
  completedAt: z.string().optional(),
});

export const uatChecklistSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  items: z.array(uatItemSchema),
  signedOffAt: z.string().optional(),
  signedOffBy: z.string().optional(),
  createdAt: z.string().min(1),
});

export const createUatChecklistInputSchema = z.object({
  labels: z.array(z.string().trim().min(1)).min(1),
});

export const completeUatItemInputSchema = z.object({
  itemId: z.string().min(1),
});

export type UatItem = z.infer<typeof uatItemSchema>;
export type UatChecklist = z.infer<typeof uatChecklistSchema>;
export type CreateUatChecklistInput = z.infer<
  typeof createUatChecklistInputSchema
>;
export type CompleteUatItemInput = z.infer<typeof completeUatItemInputSchema>;
