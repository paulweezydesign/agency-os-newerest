import { z } from "zod";

export const syncLogOutcomeSchema = z.enum([
  "success",
  "conflict",
  "rejected-field",
]);

export const syncLogDirectionSchema = z.enum(["outbound", "inbound"]);

export const syncLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  taskId: z.string().optional(),
  linearIssueId: z.string().optional(),
  direction: syncLogDirectionSchema,
  outcome: syncLogOutcomeSchema,
  message: z.string().min(1),
  rejectedFields: z.array(z.enum(["title", "description"])).optional(),
  details: z.unknown().optional(),
  createdAt: z.string().min(1),
});

export type SyncLogOutcome = z.infer<typeof syncLogOutcomeSchema>;
export type SyncLogDirection = z.infer<typeof syncLogDirectionSchema>;
export type SyncLog = z.infer<typeof syncLogSchema>;

export type SyncLogCreateInput = {
  tenantId: string;
  taskId?: string;
  linearIssueId?: string;
  direction: SyncLogDirection;
  outcome: SyncLogOutcome;
  message: string;
  rejectedFields?: Array<"title" | "description">;
  details?: unknown;
};
