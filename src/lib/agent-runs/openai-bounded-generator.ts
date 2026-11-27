import { resolveAgentRunConfig } from "./runtime-policy";
import { AgentRunUnavailable } from "./schemas";
import type { BoundedGenerator } from "./agent-run-service";

export const OPENAI_AGENT_MODEL = "openai/gpt-6-astra";

/** Server composition only. Configuration never comes from an HTTP/model payload. */
export const createOpenAIBoundedGenerator = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<BoundedGenerator> => {
  const config = resolveAgentRunConfig(env);
  if (config.modelId !== OPENAI_AGENT_MODEL && config.modelId !== "gpt-6-astra") {
    throw new AgentRunUnavailable("Synthetic agent runs require the approved gpt-6-astra model");
  }
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AgentRunUnavailable("OPENAI_API_KEY is required in the server environment");
  // Mastra's router honors OPENAI_BASE_URL. Never send this key to a custom host.
  if (env.OPENAI_BASE_URL?.trim() || process.env.OPENAI_BASE_URL?.trim()) {
    throw new AgentRunUnavailable("Custom OpenAI endpoints are not supported for synthetic agent runs");
  }
  // Disabled/unconfigured instances never initialize the model runtime.
  const { createMastraBoundedGenerator } = await import("./mastra-bounded-generator");
  return createMastraBoundedGenerator(OPENAI_AGENT_MODEL, { id: OPENAI_AGENT_MODEL, apiKey }, {
    openai: { transport: "fetch", reasoningEffort: "low", store: false, serviceTier: "default" },
  });
};
