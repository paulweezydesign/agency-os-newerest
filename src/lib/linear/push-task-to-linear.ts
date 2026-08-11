import type { Task } from "@/lib/tasks/schemas";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import type { LinearClient } from "./linear-client";
import { mapAgencyTaskToLinear } from "./map-task";
import type { SyncLogRepository } from "./sync-log-repository";

export type PushTaskToLinearDeps = {
  task: Task;
  tasks: TaskRepository;
  linear: LinearClient;
  syncLogs: SyncLogRepository;
};

export type PushTaskToLinearResult = {
  linearIssueId: string;
  task: Task;
};

export const pushTaskToLinear = async ({
  task,
  tasks,
  linear,
  syncLogs,
}: PushTaskToLinearDeps): Promise<PushTaskToLinearResult> => {
  const mapped = mapAgencyTaskToLinear(task);

  if (!task.linearIssueId) {
    const created = await linear.createIssue(mapped);
    const updated =
      (await tasks.updateByTenantAndId(task.tenantId, task.id, {
        linearIssueId: created.id,
      })) ?? task;

    await syncLogs.append({
      tenantId: task.tenantId,
      taskId: task.id,
      linearIssueId: created.id,
      direction: "outbound",
      outcome: "success",
      message: "Created Linear issue from AgencyOS task",
      details: { mapped },
    });

    return { linearIssueId: created.id, task: updated };
  }

  const updatedIssue = await linear.updateIssue(task.linearIssueId, {
    status: mapped.status,
    assignee: mapped.assignee,
    title: mapped.title,
    description: mapped.description,
  });

  await syncLogs.append({
    tenantId: task.tenantId,
    taskId: task.id,
    linearIssueId: updatedIssue.id,
    direction: "outbound",
    outcome: "success",
    message: "Updated Linear issue status/assignee from AgencyOS task",
    details: { mapped },
  });

  return { linearIssueId: updatedIssue.id, task };
};

export type SyncTaskToLinearDeps = {
  tasks: TaskRepository;
  linear: LinearClient;
  syncLogs: SyncLogRepository;
};

export const syncTaskToLinear = (deps: SyncTaskToLinearDeps) => {
  const sync = (task: Task) =>
    pushTaskToLinear({
      task,
      tasks: deps.tasks,
      linear: deps.linear,
      syncLogs: deps.syncLogs,
    });

  return sync;
};
