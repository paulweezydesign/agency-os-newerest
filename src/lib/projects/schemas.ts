import { z } from "zod";

export const createProjectInputSchema = z
  .object({
    name: z.string().trim().min(1, "Project name is required"),
    budget: z.coerce.number().nonnegative("Budget must be zero or greater"),
    timelineStart: z.string().trim().min(1, "Timeline start is required"),
    timelineEnd: z.string().trim().min(1, "Timeline end is required"),
  })
  .refine((value) => value.timelineEnd >= value.timelineStart, {
    message: "Timeline end must be on or after start",
    path: ["timelineEnd"],
  });

export const projectSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1),
  budget: z.number().nonnegative(),
  spend: z.number().nonnegative(),
  depositTotal: z.number().nonnegative().default(0),
  timelineStart: z.string().min(1),
  timelineEnd: z.string().min(1),
  githubRepo: z.string().nullable().optional(),
  createdAt: z.string().min(1),
});

export const bindGithubRepoInputSchema = z.object({
  githubRepo: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
      "GitHub repo must be owner/name",
    ),
});

export const recordProjectSpendInputSchema = z.object({
  amount: z.coerce.number().positive("Spend amount must be greater than zero"),
});

export const budgetAlertSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  threshold: z.union([z.literal(80), z.literal(100), z.literal(120)]),
  spend: z.number().nonnegative(),
  budget: z.number().nonnegative(),
  createdAt: z.string().min(1),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type Project = z.infer<typeof projectSchema>;
export type BindGithubRepoInput = z.infer<typeof bindGithubRepoInputSchema>;
export type RecordProjectSpendInput = z.infer<
  typeof recordProjectSpendInputSchema
>;
export type BudgetAlert = z.infer<typeof budgetAlertSchema>;
