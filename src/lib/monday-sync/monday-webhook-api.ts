import { ZodError } from "zod";
import type { TaskRepository } from "@/lib/tasks/task-repository";
import {
  applyMondayWebhook,
  mondayWebhookPayloadSchema,
  type ApplyMondayWebhookResult,
} from "./apply-monday-webhook";
import type { SyncLogRepository } from "./sync-log-repository";

export type WebhookApiResult =
  | { status: 200; body: ApplyMondayWebhookResult }
  | { status: 400; body: { error: string } };

export const handleMondayWebhook = async ({
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
    const payload = mondayWebhookPayloadSchema.parse(body);
    const result = await applyMondayWebhook({
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
