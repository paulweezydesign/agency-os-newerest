import { RequestContext } from "@mastra/core/request-context";
import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryExaClient } from "@/lib/exa/exa-client";
import { createHashEmbeddingClient } from "@/lib/rag/embeddings";
import { createInMemoryKnowledgeBase } from "@/lib/rag/knowledge-base";
import { createResearchTools } from "./search-tools";

const toolContext = (tenantId: string, correlationId: string) => {
  const requestContext = new RequestContext();
  requestContext.set("tenantId", tenantId);
  requestContext.set("correlationId", correlationId);
  return { requestContext } as never;
};

describe("createResearchTools", () => {
  it("runs exaSearch and logs the call", async () => {
    const actionLogs = createInMemoryAgentActionLogRepository();
    const tools = createResearchTools({
      actionLogs,
      exa: createInMemoryExaClient([
        {
          title: "Exa result",
          url: "https://example.com/r",
          snippet: "research snippet",
        },
      ]),
      knowledgeBase: createInMemoryKnowledgeBase(createHashEmbeddingClient()),
    });

    const result = (await tools.exaSearch.execute!(
      { query: "research", numResults: 3 },
      toolContext("tenant-a", "corr-1"),
    )) as { results: unknown[] };

    expect(result.results).toHaveLength(1);
    const logs = await actionLogs.listByCorrelationId("tenant-a", "corr-1");
    expect(logs[0]).toMatchObject({
      agentName: "research",
      toolName: "exaSearch",
      status: "success",
    });
  });

  it("ingests and queries with source attribution", async () => {
    const actionLogs = createInMemoryAgentActionLogRepository();
    const tools = createResearchTools({
      actionLogs,
      exa: createInMemoryExaClient(),
      knowledgeBase: createInMemoryKnowledgeBase(createHashEmbeddingClient()),
    });

    await tools.ingestDocument.execute!(
      {
        sourceId: "src-1",
        title: "RAG notes",
        text: "Vector search returns attributed excerpts.",
        url: "https://example.com/rag",
      },
      toolContext("tenant-a", "corr-2"),
    );

    const result = (await tools.queryKnowledge.execute!(
      { query: "attributed excerpts", limit: 3 },
      toolContext("tenant-a", "corr-3"),
    )) as {
      answer: string;
      sources: Array<{ sourceId: string; title: string }>;
    };

    expect(result.sources[0]?.sourceId).toBe("src-1");
    expect(result.sources[0]?.title).toBe("RAG notes");
    expect(result.answer.length).toBeGreaterThan(0);

    const ingestLogs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-2",
    );
    const queryLogs = await actionLogs.listByCorrelationId(
      "tenant-a",
      "corr-3",
    );
    expect(ingestLogs[0]?.toolName).toBe("ingestDocument");
    expect(queryLogs[0]?.toolName).toBe("queryKnowledge");
  });
});
