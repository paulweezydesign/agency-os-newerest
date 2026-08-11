import { z } from "zod";

export const bindGithubRepoInputSchema = z.object({
  githubRepo: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
      "GitHub repo must be owner/name",
    ),
});

export const openPullRequestFromTaskInputSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
});

export type BindGithubRepoInput = z.infer<typeof bindGithubRepoInputSchema>;
export type OpenPullRequestFromTaskInput = z.infer<
  typeof openPullRequestFromTaskInputSchema
>;
