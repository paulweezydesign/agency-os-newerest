import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { getGitHubClient } from "@/lib/github/get-github-client";
import { getProjectService } from "@/lib/projects/get-project-service";
import { getTaskService } from "@/lib/tasks/get-task-service";
import {
  createProjectManagerAgent,
  type ProjectManagerAgent,
} from "@/mastra/agents/project-manager";
import { getSpawnService } from "./get-spawn-service";

let cached: ProjectManagerAgent | null = null;

export const getProjectManagerAgent = async (): Promise<ProjectManagerAgent> => {
  if (cached) {
    return cached;
  }

  const taskService = await getTaskService();
  const projectService = await getProjectService();
  const spawnService = await getSpawnService();
  const actionLogs = createMongooseAgentActionLogRepository();

  cached = createProjectManagerAgent({
    taskService,
    actionLogs,
    projectService,
    github: getGitHubClient(),
    spawnService,
  });
  return cached;
};
