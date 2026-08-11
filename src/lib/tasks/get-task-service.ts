import { getProjectService } from "@/lib/projects/get-project-service";
import { connectMongo } from "@/lib/db/mongodb";
import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { getMondayRuntime } from "@/lib/monday-sync/get-monday-runtime";
import { withMondayTaskSync } from "@/lib/monday-sync/with-monday-task-sync";
import { createMongooseTaskRepository } from "./mongoose-task-repository";
import { createTaskService, type TaskService } from "./task-service";

export const getTaskService = async (): Promise<TaskService> => {
  await connectMongo();
  const projects = await getProjectService();
  const taskRepo = createMongooseTaskRepository();
  const base = createTaskService(
    taskRepo,
    projects,
    createMongooseAgentActionLogRepository(),
  );
  const { syncTask } = await getMondayRuntime();
  return withMondayTaskSync(base, syncTask);
};
