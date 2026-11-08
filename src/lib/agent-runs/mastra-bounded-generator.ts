import type { MastraModelConfig } from "@mastra/core/llm";
import { createBoundedProjectManager } from "@/mastra/agents/bounded-project-manager";
import { createBoundedTechLead } from "@/mastra/agents/bounded-tech-lead";
import { briefSchema } from "./schemas";
import type { BoundedGenerator } from "./agent-run-service";

/** Only an explicitly approved, server-selected provider adapter may supply model. */
export const createMastraBoundedGenerator = (modelId: string, model: MastraModelConfig): BoundedGenerator => ({
  modelId,
  orchestrate: async (prompt, commit, signal) => {
    const agent = createBoundedProjectManager(model, commit);
    await agent.generate(prompt, {
      maxSteps: 1, maxProcessorRetries: 0, abortSignal: signal,
      toolChoice: { type: "tool", toolName: "createTask" },
      modelSettings: { maxOutputTokens: 1500 },
    });
  },
  produceBrief: async (task, signal) => {
    const agent = createBoundedTechLead(model);
    const result = await agent.generate(JSON.stringify(task), {
      maxSteps: 1, maxProcessorRetries: 0, abortSignal: signal,
      toolChoice: "none", modelSettings: { maxOutputTokens: 3000 },
      structuredOutput: { schema: briefSchema },
    });
    return result.object;
  },
});
