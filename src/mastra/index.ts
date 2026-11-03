import type { MongoDBStore } from "@mastra/mongodb";
import { loadBetaWorkflowDeps } from "@/lib/client-pipeline/beta-workflow-deps";
import {
  createClientPipelineWorkflow,
  type PipelineWorkflowDeps,
} from "./workflows/client-pipeline";
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
  storage?: MongoDBStore;
  loadPipelineDeps?: () => Promise<PipelineWorkflowDeps>;
  projectManagerDeps?: ProjectManagerAgentDeps;
};

/**
 * Mastra app seam for AgencyOS.
 * Registers PM + seed teammates when deps are provided.
 */
export const createMastraApp = (options: CreateMastraAppOptions = {}) => {
  const { projectManagerDeps } = options;
  const workflows = {
    clientPipeline: createClientPipelineWorkflow(
      options.loadPipelineDeps ?? loadBetaWorkflowDeps,
    ),
  };

  if (!projectManagerDeps) {
    return new Mastra({
      agents: {},
      tools: {},
      workflows,
      storage: options.storage,
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
    workflows,
    storage: options.storage,
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
