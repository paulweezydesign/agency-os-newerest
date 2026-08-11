import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { getTaskService } from "@/lib/tasks/get-task-service";
import {
  createProjectManagerAgent,
  type ProjectManagerAgent,
} from "@/mastra/agents/project-manager";

let cached: ProjectManagerAgent | null = null;

export const getProjectManagerAgent = async (): Promise<ProjectManagerAgent> => {
  if (cached) {
    return cached;
  }

  const taskService = await getTaskService();
  cached = createProjectManagerAgent({
    taskService,
    actionLogs: createMongooseAgentActionLogRepository(),
  });
  return cached;
};
