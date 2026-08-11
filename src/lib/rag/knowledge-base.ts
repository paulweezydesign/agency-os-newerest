import { randomUUID } from "node:crypto";
import {
  cosineSimilarity,
  type EmbeddingClient,
} from "./embeddings";
import {
  ingestDocumentInputSchema,
  queryKnowledgeInputSchema,
  type IngestDocumentInput,
  type KnowledgeQueryResult,
  type KnowledgeSource,
  type QueryKnowledgeInput,
} from "./schemas";

export type KnowledgeDocument = {
  id: string;
  tenantId: string;
  sourceId: string;
  title: string;
  text: string;
  url?: string;
  embedding: number[];
  createdAt: string;
};

export type KnowledgeBase = {
  ingest: (
    tenantId: string,
    input: IngestDocumentInput,
  ) => Promise<KnowledgeDocument>;
  query: (
    tenantId: string,
    input: QueryKnowledgeInput,
  ) => Promise<KnowledgeQueryResult>;
};

export const createInMemoryKnowledgeBase = (
  embeddings: EmbeddingClient,
): KnowledgeBase => {
  const documents: KnowledgeDocument[] = [];

  return {
    ingest: async (tenantId, input) => {
      const parsed = ingestDocumentInputSchema.parse(input);
      const embedding = await embeddings.embed(
        `${parsed.title}\n${parsed.text}`,
      );
      const doc: KnowledgeDocument = {
        id: randomUUID(),
        tenantId,
        sourceId: parsed.sourceId,
        title: parsed.title,
        text: parsed.text,
        url: parsed.url,
        embedding,
        createdAt: new Date().toISOString(),
      };
      documents.push(doc);
      return doc;
    },
    query: async (tenantId, input) => {
      const parsed = queryKnowledgeInputSchema.parse(input);
      const limit = parsed.limit ?? 5;
      const queryEmbedding = await embeddings.embed(parsed.query);
      const ranked = documents
        .filter((doc) => doc.tenantId === tenantId)
        .map((doc) => ({
          doc,
          score: cosineSimilarity(queryEmbedding, doc.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const sources: KnowledgeSource[] = ranked.map(({ doc, score }) => ({
        sourceId: doc.sourceId,
        title: doc.title,
        url: doc.url,
        score,
        excerpt: doc.text.slice(0, 240),
      }));

      const answer =
        sources.length === 0
          ? "No sources found for this query."
          : `Based on ${sources.length} source(s): ${sources
              .map((source) => source.title)
              .join("; ")}. ${sources[0]?.excerpt ?? ""}`;

      return { answer, sources };
    },
  };
};
