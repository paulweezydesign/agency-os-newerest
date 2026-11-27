import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { createBoundedTaskTool } from "../tools/bounded-create-task";

export const createBoundedProjectManager = (
  model: MastraModelConfig,
  commit: (input: unknown) => Promise<{ taskId: string }>,
) => new Agent({
  id: "bounded-project-manager", name: "Project Manager",
  model, maxRetries: 0,
  instructions: "You are the AgencyOS Project Manager (agent). Orchestrate only. Call createTask exactly once for the supplied fictional exercise, delegating the internal brief to the Tech Lead teammate. Do not write the brief, contact anyone, use other tools, or claim work complete.",
  tools: { createTask: createBoundedTaskTool(commit) },
});
