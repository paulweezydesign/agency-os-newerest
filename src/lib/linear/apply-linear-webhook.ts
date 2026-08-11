import { z } from "zod";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import {
  mapLinearToAgencyTaskPatch,
  type LinearIssueStatus,
} from "./map-task";
import type { SyncLogRepository } from "./sync-log-repository";
import type { SyncLogOutcome } from "./sync-log-schemas";

const linearStatusSchema = z.enum(["unstarted", "started", "completed"]);

export const linearWebhookPayloadSchema = z.object({
  action: z.string(),
  data: z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().optional().default(""),
    status: linearStatusSchema,
    assignee: z.string().nullable().optional().default(null),
  }),
});

export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;

export type ApplyLinearWebhookResult = {
  outcome: SyncLogOutcome;
  taskId?: string;
  rejectedFields?: Array<"title" | "description">;
  message: string;
};

export type ApplyLinearWebhookDeps = {
  payload: LinearWebhookPayload;
  tasks: TaskRepository;
  syncLogs: SyncLogRepository;
  defaultTenantId?: string;
};

export const applyLinearWebhook = async ({
  payload,
  tasks,
  syncLogs,
  defaultTenantId = "tenant-default",
}: ApplyLinearWebhookDeps): Promise<ApplyLinearWebhookResult> => {
  const issue = {
    id: payload.data.id,
    title: payload.data.title,
    description: payload.data.description,
    status: payload.data.status as LinearIssueStatus,
    assignee: payload.data.assignee,
  };

  const task = await tasks.getByLinearIssueId(issue.id);

  if (!task) {
    await syncLogs.append({
      tenantId: defaultTenantId,
      linearIssueId: issue.id,
      direction: "inbound",
      outcome: "conflict",
      message: "No AgencyOS task linked to Linear issue",
      details: { issue },
    });

    return {
      outcome: "conflict",
      message: "No AgencyOS task linked to Linear issue",
    };
  }

  const mapped = mapLinearToAgencyTaskPatch(issue, {
    title: task.title,
    description: task.description,
  });

  await tasks.updateByTenantAndId(task.tenantId, task.id, mapped.patch);

  if (mapped.rejectedFields.length > 0) {
    await syncLogs.append({
      tenantId: task.tenantId,
      taskId: task.id,
      linearIssueId: issue.id,
      direction: "inbound",
      outcome: "rejected-field",
      message:
        "Rejected Linear edits to AgencyOS-owned scope/description; applied status/assignee",
      rejectedFields: mapped.rejectedFields,
      details: {
        attemptedTitle: issue.title,
        attemptedDescription: issue.description,
        patch: mapped.patch,
      },
    });

    return {
      outcome: "rejected-field",
      taskId: task.id,
      rejectedFields: mapped.rejectedFields,
      message:
        "Rejected Linear edits to AgencyOS-owned scope/description; applied status/assignee",
    };
  }

  await syncLogs.append({
    tenantId: task.tenantId,
    taskId: task.id,
    linearIssueId: issue.id,
    direction: "inbound",
    outcome: "success",
    message: "Applied Linear status/assignee to AgencyOS task",
    details: { patch: mapped.patch },
  });

  return {
    outcome: "success",
    taskId: task.id,
    message: "Applied Linear status/assignee to AgencyOS task",
  };
};
