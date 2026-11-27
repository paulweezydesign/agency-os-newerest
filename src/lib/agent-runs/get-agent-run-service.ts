import { connectMongo } from "@/lib/db/mongodb";
import { createMongooseAgentRunRepository } from "./mongoose-agent-run-repository";
import { createAgentRunService, type AgentRunService } from "./agent-run-service";
import { createOpenAIBoundedGenerator } from "./openai-bounded-generator";

export const getAgentRunRepository = async () => {
  await connectMongo();
  return createMongooseAgentRunRepository();
};

/** Validate explicit provider/scope configuration before connecting durable storage.
 * Model requests occur only after the service has committed its run admission.
 */
export const getAgentRunService = async (): Promise<AgentRunService> => {
  const generator = await createOpenAIBoundedGenerator();
  return createAgentRunService(await getAgentRunRepository(), generator);
};
