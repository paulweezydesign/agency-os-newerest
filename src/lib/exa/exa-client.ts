export type ExaSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type ExaClient = {
  search: (input: {
    query: string;
    numResults?: number;
  }) => Promise<ExaSearchResult[]>;
};

export class ExaClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExaClientError";
  }
}

export type InMemoryExaClient = ExaClient & {
  queries: string[];
};

export const createInMemoryExaClient = (
  seed: ExaSearchResult[] = [],
): InMemoryExaClient => {
  const queries: string[] = [];
  const catalog =
    seed.length > 0
      ? seed
      : [
          {
            title: "AgencyOS research note",
            url: "https://example.com/agencyos",
            snippet: "Hybrid agency OS with agent workforce.",
          },
        ];

  return {
    queries,
    search: async ({ query, numResults = 5 }) => {
      if (query.trim().length === 0) {
        throw new ExaClientError("query is required");
      }

      queries.push(query);
      return catalog
        .filter(
          (item) =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.snippet.toLowerCase().includes(query.toLowerCase()) ||
            catalog.length === 1,
        )
        .slice(0, numResults);
    },
  };
};
