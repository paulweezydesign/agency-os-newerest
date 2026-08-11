import { createTool } from "@mastra/core/tools";
import type { ToolExecutionContext } from "@mastra/core/tools";
import { z } from "zod";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { ExaClient } from "@/lib/exa/exa-client";
import type { KnowledgeBase } from "@/lib/rag/knowledge-base";
import {
  ingestDocumentInputSchema,
  queryKnowledgeInputSchema,
} from "@/lib/rag/schemas";

export const exaSearchInputSchema = z.object({
  query: z.string().min(1),
  numResults: z.number().int().min(1).max(10).default(5),
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

export type ResearchToolDeps = {
  actionLogs: AgentActionLogRepository;
  exa: ExaClient;
  knowledgeBase: KnowledgeBase;
};

export const createExaSearchTool = (deps: ResearchToolDeps) =>
  createTool({
    id: "exaSearch",
    description: "Search the web via Exa for research evidence.",
    inputSchema: exaSearchInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);

      try {
        const results = await deps.exa.search(input);
        await deps.actionLogs.append({
          tenantId,
          agentName: "research",
          toolName: "exaSearch",
          input,
          output: { results },
          status: "success",
          correlationId,
        });
        return { results };
      } catch (error) {
        await deps.actionLogs.append({
          tenantId,
          agentName: "research",
          toolName: "exaSearch",
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

export const createIngestDocumentTool = (deps: ResearchToolDeps) =>
  createTool({
    id: "ingestDocument",
    description: "Ingest a document into the tenant knowledge base.",
    inputSchema: ingestDocumentInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);

      try {
        const doc = await deps.knowledgeBase.ingest(tenantId, input);
        await deps.actionLogs.append({
          tenantId,
          agentName: "research",
          toolName: "ingestDocument",
          input,
          output: { id: doc.id, sourceId: doc.sourceId },
          status: "success",
          correlationId,
        });
        return { id: doc.id, sourceId: doc.sourceId };
      } catch (error) {
        await deps.actionLogs.append({
          tenantId,
          agentName: "research",
          toolName: "ingestDocument",
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

export const createQueryKnowledgeTool = (deps: ResearchToolDeps) =>
  createTool({
    id: "queryKnowledge",
    description:
      "Query ingested knowledge and return an answer with source attribution.",
    inputSchema: queryKnowledgeInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);

      try {
        const result = await deps.knowledgeBase.query(tenantId, input);
        await deps.actionLogs.append({
          tenantId,
          agentName: "research",
          toolName: "queryKnowledge",
          input,
          output: result,
          status: "success",
          correlationId,
        });
        return result;
      } catch (error) {
        await deps.actionLogs.append({
          tenantId,
          agentName: "research",
          toolName: "queryKnowledge",
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

export const createResearchTools = (deps: ResearchToolDeps) => ({
  exaSearch: createExaSearchTool(deps),
  ingestDocument: createIngestDocumentTool(deps),
  queryKnowledge: createQueryKnowledgeTool(deps),
});
