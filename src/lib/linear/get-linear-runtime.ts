import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { connectMongo } from "@/lib/db/mongodb";
import { getSlackClient } from "@/lib/slack/get-slack-client";
import { createSlackNotifier } from "@/lib/slack/notify";
import { createNotifyingSyncLogRepository } from "@/lib/slack/notifying-sync-log-repository";
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
  const linear = getSharedLinearClient();
  const notifier = createSlackNotifier({
    slack: getSlackClient(),
    actionLogs: createMongooseAgentActionLogRepository(),
  });
  const syncLogs = createNotifyingSyncLogRepository(
    createMongooseSyncLogRepository(),
    notifier,
    "linear",
  );

  return {
    tasks,
    syncLogs,
    linear,
    syncTask: syncTaskToLinear({ tasks, linear, syncLogs }),
  };
};
