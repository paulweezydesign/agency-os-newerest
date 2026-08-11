import { createTool } from "@mastra/core/tools";
import type { ToolExecutionContext } from "@mastra/core/tools";
import { z } from "zod";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { ClientPipelineService } from "@/lib/client-pipeline/client-pipeline-service";

export const runClientPipelineInputSchema = z.object({
  clientId: z.string().min(1),
  leadScore: z.number().int().min(0).max(100),
  contactEmail: z.string().email().optional(),
});

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

export const createRunClientPipelineTool = (deps: {
  pipeline: ClientPipelineService;
  actionLogs: AgentActionLogRepository;
  agentName: string;
}) =>
  createTool({
    id: "runClientPipeline",
    description:
      "Run the client pipeline with lead-score branching. Client emails are queued behind policy gates (never sent directly).",
    inputSchema: runClientPipelineInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);

      try {
        const result = await deps.pipeline.run({
          tenantId,
          clientId: input.clientId,
          leadScore: input.leadScore,
          contactEmail: input.contactEmail,
          requestedBy: deps.agentName,
          correlationId,
        });

        await deps.actionLogs.append({
          tenantId,
          agentName: deps.agentName,
          toolName: "runClientPipeline",
          input,
          output: {
            branch: result.branch,
            stage: result.client.pipelineStage,
            pendingEmailGateIds: result.pendingEmailGates.map((gate) => gate.id),
          },
          status: "success",
          correlationId,
        });

        return result;
      } catch (error) {
        await deps.actionLogs.append({
          tenantId,
          agentName: deps.agentName,
          toolName: "runClientPipeline",
          input,
          output: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          status: "error",
          correlationId,
        });
        throw error;
      }
    },
  });
