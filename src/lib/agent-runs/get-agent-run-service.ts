import { connectMongo } from "@/lib/db/mongodb";
import { createMongooseAgentRunRepository } from "./mongoose-agent-run-repository";
import { AgentRunUnavailable } from "./schemas";
import type { AgentRunService } from "./agent-run-service";

export const getAgentRunRepository = async () => {
  await connectMongo();
  return createMongooseAgentRunRepository();
};

/** Deliberately no default provider, credential lookup, or model initialization.
 * Wire an approved server-side adapter here only after provider/budget acceptance.
 * The domain service and Mastra factories are exercised with injected models in tests.
 */
export const getAgentRunService = async (): Promise<AgentRunService> => {
  throw new AgentRunUnavailable("Live model adapter requires explicit provider approval and configuration");
};
