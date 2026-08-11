import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { PolicyGate } from "@/lib/policy-gates/schemas";
import type { BudgetAlert } from "@/lib/projects/schemas";
import type { SlackClient } from "./slack-client";

export type SyncFailureLog = {
  taskId?: string;
  outcome: "success" | "conflict" | "rejected-field";
  message: string;
  direction: "outbound" | "inbound";
  details?: unknown;
};

export type SlackNotifier = {
  notifyPolicyGate: (input: {
    tenantId: string;
    event: "requested" | "approved" | "denied";
    gate: PolicyGate;
    correlationId: string;
  }) => Promise<void>;
  notifyBudgetAlert: (input: {
    tenantId: string;
    alert: BudgetAlert;
    correlationId: string;
  }) => Promise<void>;
  notifySyncFailure: (input: {
    tenantId: string;
    tracker: "monday" | "linear";
    log: SyncFailureLog;
    correlationId: string;
  }) => Promise<void>;
};

const DEFAULT_CHANNEL = "#agencyos-ops";

const safePost = async (input: {
  slack: SlackClient;
  actionLogs: AgentActionLogRepository;
  tenantId: string;
  correlationId: string;
  toolName: string;
  channel: string;
  text: string;
  metadata: Record<string, unknown>;
  projectId?: string;
  taskId?: string;
}): Promise<void> => {
  try {
    const result = await input.slack.postMessage({
      channel: input.channel,
      text: input.text,
      metadata: input.metadata,
    });

    await input.actionLogs.append({
      tenantId: input.tenantId,
      agentName: "slack-notifier",
      toolName: input.toolName,
      input: {
        channel: input.channel,
        text: input.text,
        metadata: input.metadata,
      },
      output: result,
      status: "success",
      correlationId: input.correlationId,
      projectId: input.projectId,
      taskId: input.taskId,
    });
  } catch (error) {
    await input.actionLogs.append({
      tenantId: input.tenantId,
      agentName: "slack-notifier",
      toolName: input.toolName,
      input: {
        channel: input.channel,
        text: input.text,
        metadata: input.metadata,
      },
      output: {
        error: error instanceof Error ? error.message : "Unknown Slack error",
      },
      status: "error",
      correlationId: input.correlationId,
      projectId: input.projectId,
      taskId: input.taskId,
    });
  }
};

export const createSlackNotifier = (deps: {
  slack: SlackClient;
  actionLogs: AgentActionLogRepository;
  channel?: string;
}): SlackNotifier => {
  const channel = deps.channel ?? DEFAULT_CHANNEL;

  return {
    notifyPolicyGate: async ({ tenantId, event, gate, correlationId }) => {
      await safePost({
        slack: deps.slack,
        actionLogs: deps.actionLogs,
        tenantId,
        correlationId,
        toolName: "slack.notifyPolicyGate",
        channel,
        text: `Policy gate ${event}: ${gate.actionType} (${gate.id})`,
        metadata: {
          event,
          gateId: gate.id,
          actionType: gate.actionType,
          status: gate.status,
        },
        projectId: gate.projectId,
      });
    },
    notifyBudgetAlert: async ({ tenantId, alert, correlationId }) => {
      await safePost({
        slack: deps.slack,
        actionLogs: deps.actionLogs,
        tenantId,
        correlationId,
        toolName: "slack.notifyBudgetAlert",
        channel,
        text: `Budget alert ${alert.threshold}% on project ${alert.projectId} (spend ${alert.spend}/${alert.budget})`,
        metadata: {
          projectId: alert.projectId,
          threshold: alert.threshold,
          spend: alert.spend,
          budget: alert.budget,
        },
        projectId: alert.projectId,
      });
    },
    notifySyncFailure: async ({
      tenantId,
      tracker,
      log,
      correlationId,
    }) => {
      await safePost({
        slack: deps.slack,
        actionLogs: deps.actionLogs,
        tenantId,
        correlationId,
        toolName: "slack.notifySyncFailure",
        channel,
        text: `${tracker} sync ${log.outcome}${log.taskId ? ` for task ${log.taskId}` : ""}: ${log.message}`,
        metadata: {
          tracker,
          taskId: log.taskId,
          outcome: log.outcome,
          direction: log.direction,
          message: log.message,
          details: log.details,
        },
        taskId: log.taskId,
      });
    },
  };
};
