import { Mastra } from "@mastra/core";
import {
  createProjectManagerAgent,
  type ProjectManagerAgentDeps,
} from "./agents/project-manager";
import { createSeedTeammateAgents } from "./agents/teammates";
import { createProjectManagerGithubTools } from "./tools/github-tools";
import { createProjectManagerSpawnTools } from "./tools/spawn-tools";
import { createProjectManagerTaskTools } from "./tools/task-tools";

export type CreateMastraAppOptions = {
  projectManagerDeps?: ProjectManagerAgentDeps;
};

/**
 * Mastra app seam for AgencyOS.
 * Registers PM + seed teammates when deps are provided.
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

  const tools = {
    ...createProjectManagerTaskTools(projectManagerDeps),
    ...createProjectManagerGithubTools(projectManagerDeps),
    ...(projectManagerDeps.spawnService
      ? createProjectManagerSpawnTools({
          spawnService: projectManagerDeps.spawnService,
        })
      : {}),
  };
  const projectManager = createProjectManagerAgent(projectManagerDeps);
  const teammates = createSeedTeammateAgents({
    actionLogs: projectManagerDeps.actionLogs,
  });

  return new Mastra({
    agents: {
      projectManager,
      ...teammates,
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
export { createProjectManagerGithubTools } from "./tools/github-tools";
export { createProjectManagerSpawnTools } from "./tools/spawn-tools";
export { createSeedTeammateAgents } from "./agents/teammates";
