import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { connectMongo } from "@/lib/db/mongodb";
import { getSlackClient } from "@/lib/slack/get-slack-client";
import { createSlackNotifier } from "@/lib/slack/notify";
import { createNotifyingSyncLogRepository } from "@/lib/slack/notifying-sync-log-repository";
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
  const monday = getSharedMondayClient();
  const notifier = createSlackNotifier({
    slack: getSlackClient(),
    actionLogs: createMongooseAgentActionLogRepository(),
  });
  const syncLogs = createNotifyingSyncLogRepository(
    createMongooseSyncLogRepository(),
    notifier,
    "monday",
  );

  return {
    tasks,
    syncLogs,
    monday,
    syncTask: syncTaskToMonday({ tasks, monday, syncLogs }),
  };
};
