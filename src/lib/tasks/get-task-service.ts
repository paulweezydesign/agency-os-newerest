import { getProjectService } from "@/lib/projects/get-project-service";
import { connectMongo } from "@/lib/db/mongodb";
import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { createMongooseTaskRepository } from "./mongoose-task-repository";
import { createTaskService, type TaskService } from "./task-service";

export const getTaskService = async (): Promise<TaskService> => {
  await connectMongo();
  const projects = await getProjectService();
  return createTaskService(
    createMongooseTaskRepository(),
    projects,
    createMongooseAgentActionLogRepository(),
  );
};
