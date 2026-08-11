import { z } from "zod";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import {
  mapMondayToAgencyTaskPatch,
  type MondayItemStatus,
} from "./map-task";
import type { SyncLogRepository } from "./sync-log-repository";
import type { SyncLogOutcome } from "./sync-log-schemas";

const mondayStatusSchema = z.enum(["not_started", "working_on_it", "done"]);

export const mondayWebhookPayloadSchema = z.object({
  action: z.string(),
  data: z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().optional().default(""),
    status: mondayStatusSchema,
    assignee: z.string().nullable().optional().default(null),
  }),
});

export type MondayWebhookPayload = z.infer<typeof mondayWebhookPayloadSchema>;

export type ApplyMondayWebhookResult = {
  outcome: SyncLogOutcome;
  taskId?: string;
  rejectedFields?: Array<"title" | "description">;
  message: string;
};

export type ApplyMondayWebhookDeps = {
  payload: MondayWebhookPayload;
  tasks: TaskRepository;
  syncLogs: SyncLogRepository;
  defaultTenantId?: string;
};

export const applyMondayWebhook = async ({
  payload,
  tasks,
  syncLogs,
  defaultTenantId = "tenant-default",
}: ApplyMondayWebhookDeps): Promise<ApplyMondayWebhookResult> => {
  const item = {
    id: payload.data.id,
    title: payload.data.title,
    description: payload.data.description,
    status: payload.data.status as MondayItemStatus,
    assignee: payload.data.assignee,
  };

  const task = await tasks.getByMondayItemId(item.id);

  if (!task) {
    await syncLogs.append({
      tenantId: defaultTenantId,
      mondayItemId: item.id,
      direction: "inbound",
      outcome: "conflict",
      message: "No AgencyOS task linked to Monday item",
      details: { item },
    });

    return {
      outcome: "conflict",
      message: "No AgencyOS task linked to Monday item",
    };
  }

  const mapped = mapMondayToAgencyTaskPatch(item, {
    title: task.title,
    description: task.description,
  });

  await tasks.updateByTenantAndId(task.tenantId, task.id, mapped.patch);

  if (mapped.rejectedFields.length > 0) {
    await syncLogs.append({
      tenantId: task.tenantId,
      taskId: task.id,
      mondayItemId: item.id,
      direction: "inbound",
      outcome: "rejected-field",
      message:
        "Rejected Monday edits to AgencyOS-owned scope/description; applied status/assignee",
      rejectedFields: mapped.rejectedFields,
      details: {
        attemptedTitle: item.title,
        attemptedDescription: item.description,
        patch: mapped.patch,
      },
    });

    return {
      outcome: "rejected-field",
      taskId: task.id,
      rejectedFields: mapped.rejectedFields,
      message:
        "Rejected Monday edits to AgencyOS-owned scope/description; applied status/assignee",
    };
  }

  await syncLogs.append({
    tenantId: task.tenantId,
    taskId: task.id,
    mondayItemId: item.id,
    direction: "inbound",
    outcome: "success",
    message: "Applied Monday status/assignee to AgencyOS task",
    details: { patch: mapped.patch },
  });

  return {
    outcome: "success",
    taskId: task.id,
    message: "Applied Monday status/assignee to AgencyOS task",
  };
};
