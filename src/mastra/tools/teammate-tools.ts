import { createTool } from "@mastra/core/tools";
import type { ToolExecutionContext } from "@mastra/core/tools";
import { z } from "zod";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";

export const reportStatusInputSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  summary: z.string().trim().min(1, "summary is required"),
  status: z.enum(["blocked", "in_progress", "done"]).default("in_progress"),
});

export type TeammateToolDeps = {
  actionLogs: AgentActionLogRepository;
  agentName: string;
};

type ToolRequestFields = {
  tenantId: string;
  correlationId: string;
};

const readRequestFields = (
  context?: ToolExecutionContext,
): ToolRequestFields => {
  const requestContext = context?.requestContext;
  const tenantId = requestContext?.get("tenantId");
  const correlationId = requestContext?.get("correlationId");

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("requestContext.tenantId is required");
  }

  if (typeof correlationId !== "string" || correlationId.length === 0) {
    throw new Error("requestContext.correlationId is required");
  }

  return { tenantId, correlationId };
};

export const createReportStatusTool = ({
  actionLogs,
  agentName,
}: TeammateToolDeps) =>
  createTool({
    id: "reportStatus",
    description:
      "Report progress or blockers on assigned work. Logs status for the Project Manager; does not contact clients or move money.",
    inputSchema: reportStatusInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);
      const reportedAt = new Date().toISOString();
      const output = {
        acknowledged: true as const,
        reportedAt,
        ...input,
      };

      await actionLogs.append({
        tenantId,
        agentName,
        toolName: "reportStatus",
        input,
        output,
        status: "success",
        correlationId,
        projectId: input.projectId,
      });

      return output;
    },
  });

export const createTeammateTools = (deps: TeammateToolDeps) => ({
  reportStatus: createReportStatusTool(deps),
});
