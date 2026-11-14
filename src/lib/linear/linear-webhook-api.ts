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

type WebhookRuntime = {
  tasks: TaskRepository;
  syncLogs: SyncLogRepository;
};

type WebhookInput = {
  body: unknown;
  defaultTenantId?: string;
} & (WebhookRuntime | { getRuntime: () => Promise<WebhookRuntime> });

export const handleLinearWebhook = async (
  input: WebhookInput,
): Promise<WebhookApiResult> => {
  try {
    const payload = linearWebhookPayloadSchema.parse(input.body);
    // Do not initialize storage for malformed webhook requests.
    const { tasks, syncLogs } = "getRuntime" in input ? await input.getRuntime() : input;
    const result = await applyLinearWebhook({
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
