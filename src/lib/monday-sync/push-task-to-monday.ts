import type { Task } from "@/lib/tasks/schemas";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import type { MondayClient } from "./monday-client";
import { mapAgencyTaskToMonday } from "./map-task";
import type { SyncLogRepository } from "./sync-log-repository";

export type PushTaskToMondayDeps = {
  task: Task;
  tasks: TaskRepository;
  monday: MondayClient;
  syncLogs: SyncLogRepository;
};

export type PushTaskToMondayResult = {
  mondayItemId: string;
  task: Task;
};

export const pushTaskToMonday = async ({
  task,
  tasks,
  monday,
  syncLogs,
}: PushTaskToMondayDeps): Promise<PushTaskToMondayResult> => {
  const mapped = mapAgencyTaskToMonday(task);

  if (!task.mondayItemId) {
    const created = await monday.createItem(mapped);
    const updated =
      (await tasks.updateByTenantAndId(task.tenantId, task.id, {
        mondayItemId: created.id,
      })) ?? task;

    await syncLogs.append({
      tenantId: task.tenantId,
      taskId: task.id,
      mondayItemId: created.id,
      direction: "outbound",
      outcome: "success",
      message: "Created Monday item from AgencyOS task",
      details: { mapped },
    });

    return { mondayItemId: created.id, task: updated };
  }

  const updatedItem = await monday.updateItem(task.mondayItemId, {
    status: mapped.status,
    assignee: mapped.assignee,
    title: mapped.title,
    description: mapped.description,
  });

  await syncLogs.append({
    tenantId: task.tenantId,
    taskId: task.id,
    mondayItemId: updatedItem.id,
    direction: "outbound",
    outcome: "success",
    message: "Updated Monday item status/assignee from AgencyOS task",
    details: { mapped },
  });

  return { mondayItemId: updatedItem.id, task };
};

export type SyncTaskToMondayDeps = {
  tasks: TaskRepository;
  monday: MondayClient;
  syncLogs: SyncLogRepository;
};

export const syncTaskToMonday = (deps: SyncTaskToMondayDeps) => {
  const sync = (task: Task) =>
    pushTaskToMonday({
      task,
      tasks: deps.tasks,
      monday: deps.monday,
      syncLogs: deps.syncLogs,
    });

  return sync;
};
