import { createHashEmbeddingClient } from "./embeddings";
import {
  createInMemoryKnowledgeBase,
  type KnowledgeBase,
} from "./knowledge-base";

let shared: KnowledgeBase | null = null;

export const getKnowledgeBase = (): KnowledgeBase => {
  shared ??= createInMemoryKnowledgeBase(createHashEmbeddingClient());
  return shared;
};
