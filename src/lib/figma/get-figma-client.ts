import {
  createInMemoryFigmaClient,
  type FigmaClient,
  type InMemoryFigmaClient,
} from "./figma-client";

let shared: FigmaClient | null = null;

/** v1 demo Figma client; swap for HTTP Files API when FIGMA_ACCESS_TOKEN is set. */
export const getFigmaClient = (): FigmaClient => {
  if (shared) {
    return shared;
  }

  const client: InMemoryFigmaClient = createInMemoryFigmaClient();
  client.seedFile({ key: "AbCdEf123", name: "Demo Homepage" });
  shared = client;
  return shared;
};

export const resetFigmaClientForTests = (): void => {
  shared = null;
};
