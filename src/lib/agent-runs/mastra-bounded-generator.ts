import type { MastraModelConfig } from "@mastra/core/llm";
import type { AgentExecutionOptions } from "@mastra/core/agent";
import { noopLogger } from "@mastra/core/logger";
import { createBoundedProjectManager } from "@/mastra/agents/bounded-project-manager";
import { createBoundedTechLead } from "@/mastra/agents/bounded-tech-lead";
import { briefSchema } from "./schemas";
import type { BoundedGenerator } from "./agent-run-service";

/** Only an explicitly approved, server-selected provider adapter may supply model. */
export const createMastraBoundedGenerator = (
  modelId: string,
  model: MastraModelConfig,
  providerOptions?: AgentExecutionOptions["providerOptions"],
): BoundedGenerator => ({
  modelId,
  orchestrate: async (prompt, commit, signal) => {
    signal.throwIfAborted();
    const agent = createBoundedProjectManager(model, commit);
    // Provider failures can contain request data. Durable domain checkpoints are
    // the audit trail; never emit raw SDK errors or credential-bearing config.
    agent.__setLogger(noopLogger);
    const result = await agent.generate(prompt, {
      maxSteps: 1, maxProcessorRetries: 0, errorProcessors: [], abortSignal: signal,
      providerOptions,
      toolChoice: { type: "tool", toolName: "createTask" },
      modelSettings: { maxOutputTokens: 1500, maxRetries: 0 },
    });
    signal.throwIfAborted();
    if (result.error || result.tripwire || !["stop", "tool-calls"].includes(result.finishReason ?? "")) {
      throw new Error("Project Manager response did not complete");
    }
  },
  produceBrief: async (task, signal) => {
    signal.throwIfAborted();
    const agent = createBoundedTechLead(model);
    agent.__setLogger(noopLogger);
    const result = await agent.generate(JSON.stringify(task), {
      maxSteps: 1, maxProcessorRetries: 0, errorProcessors: [], abortSignal: signal,
      providerOptions,
      toolChoice: "none", modelSettings: { maxOutputTokens: 3000, maxRetries: 0 },
      structuredOutput: { schema: briefSchema, errorStrategy: "strict" },
    });
    signal.throwIfAborted();
    if (result.error || result.tripwire || result.finishReason !== "stop") {
      throw new Error("Tech Lead response did not complete");
    }
    return result.object;
  },
});
