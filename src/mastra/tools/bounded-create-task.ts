import { createTool } from "@mastra/core/tools";
import { taskProposalSchema } from "@/lib/agent-runs/schemas";
/** Scope is captured by the server callback, never accepted from model arguments. */
export const createBoundedTaskTool = (commit: (input: unknown) => Promise<{ taskId: string }>) =>
  createTool({
    id: "createTask",
    description: "Create the single internal Task for the assigned synthetic Project and Tech Lead teammate.",
    inputSchema: taskProposalSchema,
    execute: async input => commit(input),
  });
