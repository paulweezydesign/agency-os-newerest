import { Mastra } from "@mastra/core";

/**
 * Minimal Mastra app seam for AgencyOS Slice A.
 * Agents, tools, and workflows are registered in later slices.
 */
export const createMastraApp = () =>
  new Mastra({
    agents: {},
    tools: {},
    workflows: {},
  });

export const mastra = createMastraApp();
