/**
 * Deterministic bag-of-words embedding stand-in for text-embedding-3-small.
 * Swap for a real OpenAI embedding client when OPENAI_API_KEY is configured.
 */
export type EmbeddingClient = {
  embed: (text: string) => Promise<number[]>;
};

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

export const createHashEmbeddingClient = (
  dimensions = 64,
): EmbeddingClient => ({
  embed: async (text) => {
    const vector = Array.from({ length: dimensions }, () => 0);
    for (const token of tokenize(text)) {
      let hash = 0;
      for (let i = 0; i < token.length; i += 1) {
        hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
      }
      const index = hash % dimensions;
      vector[index] = (vector[index] ?? 0) + 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
      return vector;
    }
    return vector.map((value) => value / norm);
  },
});

export const cosineSimilarity = (a: number[], b: number[]): number => {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
};
