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

type WebhookRuntime = {
  tasks: TaskRepository;
  syncLogs: SyncLogRepository;
};

type WebhookInput = {
  body: unknown;
  defaultTenantId?: string;
} & (WebhookRuntime | { getRuntime: () => Promise<WebhookRuntime> });

export const handleMondayWebhook = async (
  input: WebhookInput,
): Promise<WebhookApiResult> => {
  try {
    const payload = mondayWebhookPayloadSchema.parse(input.body);
    // Do not initialize storage for malformed webhook requests.
    const { tasks, syncLogs } = "getRuntime" in input ? await input.getRuntime() : input;
    const result = await applyMondayWebhook({
      payload,
      tasks,
      syncLogs,
      defaultTenantId: input.defaultTenantId,
    });
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid webhook payload" } };
    }
    throw error;
  }
};
