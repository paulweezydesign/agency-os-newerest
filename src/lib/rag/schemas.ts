import { z } from "zod";

export const ingestDocumentInputSchema = z.object({
  sourceId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  text: z.string().trim().min(1),
  url: z.string().url().optional(),
});

export const queryKnowledgeInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export const knowledgeSourceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().optional(),
  score: z.number(),
  excerpt: z.string().min(1),
});

export const knowledgeQueryResultSchema = z.object({
  answer: z.string().min(1),
  sources: z.array(knowledgeSourceSchema),
});

export type IngestDocumentInput = z.infer<typeof ingestDocumentInputSchema>;
export type QueryKnowledgeInput = z.input<typeof queryKnowledgeInputSchema>;
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type KnowledgeQueryResult = z.infer<typeof knowledgeQueryResultSchema>;
