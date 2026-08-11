import { connectMongo } from "@/lib/db/mongodb";
import { createMongooseTaskRepository } from "@/lib/tasks/mongoose-task-repository";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import { createInMemoryMondayClient, type MondayClient } from "./monday-client";
import { createMongooseSyncLogRepository } from "./mongoose-sync-log-repository";
import type { SyncLogRepository } from "./sync-log-repository";
import { syncTaskToMonday } from "./push-task-to-monday";

type MondayRuntime = {
  tasks: TaskRepository;
  syncLogs: SyncLogRepository;
  monday: MondayClient;
  syncTask: ReturnType<typeof syncTaskToMonday>;
};

let sharedMonday: MondayClient | null = null;

const getSharedMondayClient = (): MondayClient => {
  sharedMonday ??= createInMemoryMondayClient();
  return sharedMonday;
};

export const getMondayRuntime = async (): Promise<MondayRuntime> => {
  await connectMongo();
  const tasks = createMongooseTaskRepository();
  const syncLogs = createMongooseSyncLogRepository();
  const monday = getSharedMondayClient();

  return {
    tasks,
    syncLogs,
    monday,
    syncTask: syncTaskToMonday({ tasks, monday, syncLogs }),
  };
};
