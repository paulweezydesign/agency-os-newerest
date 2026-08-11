import { connectMongo } from "@/lib/db/mongodb";
import { createMongooseTaskRepository } from "@/lib/tasks/mongoose-task-repository";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import { createInMemoryLinearClient, type LinearClient } from "./linear-client";
import { createMongooseSyncLogRepository } from "./mongoose-sync-log-repository";
import type { SyncLogRepository } from "./sync-log-repository";
import { syncTaskToLinear } from "./push-task-to-linear";

type LinearRuntime = {
  tasks: TaskRepository;
  syncLogs: SyncLogRepository;
  linear: LinearClient;
  syncTask: ReturnType<typeof syncTaskToLinear>;
};

let sharedLinear: LinearClient | null = null;

const getSharedLinearClient = (): LinearClient => {
  sharedLinear ??= createInMemoryLinearClient();
  return sharedLinear;
};

export const getLinearRuntime = async (): Promise<LinearRuntime> => {
  await connectMongo();
  const tasks = createMongooseTaskRepository();
  const syncLogs = createMongooseSyncLogRepository();
  const linear = getSharedLinearClient();

  return {
    tasks,
    syncLogs,
    linear,
    syncTask: syncTaskToLinear({ tasks, linear, syncLogs }),
  };
};
