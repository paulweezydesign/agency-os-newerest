import { AgentRunUnavailable } from "./schemas";
export type AgentRunConfig = { tenantId: string; projectId: string; modelId: string };
export const resolveAgentRunConfig = (env: NodeJS.ProcessEnv = process.env): AgentRunConfig => {
  const local = env.NODE_ENV === "development" && !env.VERCEL_ENV && !env.VERCEL;
  const preview = env.VERCEL_ENV === "preview" && env.AGENCYOS_AGENT_RUN_PROTECTED_PREVIEW === "true";
  if (env.AGENCYOS_AGENT_RUN_ENABLED !== "true" || (!local && !preview) || env.VERCEL_ENV === "production") {
    throw new AgentRunUnavailable("Synthetic agent execution is disabled");
  }
  const tenantId = env.AGENCYOS_AGENT_RUN_TENANT_ID?.trim();
  const projectId = env.AGENCYOS_AGENT_RUN_PROJECT_ID?.trim();
  const modelId = env.AGENCYOS_AGENT_RUN_MODEL?.trim();
  if (!tenantId || !projectId || !/^[a-f\d]{24}$/i.test(projectId) || !modelId) {
    throw new AgentRunUnavailable("Explicit synthetic scope and approved model configuration required");
  }
  return { tenantId, projectId, modelId };
};
