import {
  createInMemoryExaClient,
  type ExaClient,
} from "./exa-client";

let shared: ExaClient | null = null;

/** v1 demo Exa client; replace with HTTP client when EXA_API_KEY is set. */
export const getExaClient = (): ExaClient => {
  shared ??= createInMemoryExaClient();
  return shared;
};
