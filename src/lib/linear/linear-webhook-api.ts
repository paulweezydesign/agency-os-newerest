import { ZodError } from "zod";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import {
  applyLinearWebhook,
  linearWebhookPayloadSchema,
  type ApplyLinearWebhookResult,
} from "./apply-linear-webhook";
import type { SyncLogRepository } from "./sync-log-repository";

export type WebhookApiResult =
  | { status: 200; body: ApplyLinearWebhookResult }
  | { status: 400; body: { error: string } };

export const handleLinearWebhook = async ({
  body,
  tasks,
  syncLogs,
  defaultTenantId,
}: {
  body: unknown;
  tasks: TaskRepository;
  syncLogs: SyncLogRepository;
  defaultTenantId?: string;
}): Promise<WebhookApiResult> => {
  try {
    const payload = linearWebhookPayloadSchema.parse(body);
    const result = await applyLinearWebhook({
      payload,
      tasks,
      syncLogs,
      defaultTenantId,
    });
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid webhook payload" } };
    }
    throw error;
  }
};
