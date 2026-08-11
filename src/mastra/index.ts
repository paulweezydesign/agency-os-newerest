import { Mastra } from "@mastra/core";
import { createProjectManagerAgent } from "./agents/project-manager";
import type { ProjectManagerToolDeps } from "./tools/task-tools";
import { createProjectManagerTaskTools } from "./tools/task-tools";

export type CreateMastraAppOptions = {
  projectManagerDeps?: ProjectManagerToolDeps;
};

/**
 * Mastra app seam for AgencyOS.
 * Registers the Project Manager agent + task tools when deps are provided.
 * Production routes resolve a live agent via getProjectManagerAgent.
 */
export const createMastraApp = (options: CreateMastraAppOptions = {}) => {
  const { projectManagerDeps } = options;

  if (!projectManagerDeps) {
    return new Mastra({
      agents: {},
      tools: {},
      workflows: {},
    });
  }

  const tools = createProjectManagerTaskTools(projectManagerDeps);
  const projectManager = createProjectManagerAgent(projectManagerDeps);

  return new Mastra({
    agents: {
      projectManager,
    },
    tools,
    workflows: {},
  });
};

export const mastra = createMastraApp();

export { createProjectManagerAgent } from "./agents/project-manager";
export { PROJECT_MANAGER_INSTRUCTIONS } from "./agents/project-manager";
export {
  PROJECT_MANAGER_AGENT_NAME,
  createProjectManagerTaskTools,
} from "./tools/task-tools";
