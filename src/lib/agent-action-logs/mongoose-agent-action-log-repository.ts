import type {
  AgentActionLogRepository,
} from "./agent-action-log-repository";
import type { AgentActionLogCreateInput } from "./schemas";
import { getAgentActionLogModel } from "./agent-action-log-model";
import type { AgentActionLog } from "./schemas";

const toLog = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  agentName: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: "success" | "error";
  correlationId: string;
  projectId?: string | null;
  taskId?: string | null;
  timestamp: Date;
}): AgentActionLog => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  agentName: doc.agentName,
  toolName: doc.toolName,
  input: doc.input,
  output: doc.output,
  status: doc.status,
  correlationId: doc.correlationId,
  projectId: doc.projectId ?? undefined,
  taskId: doc.taskId ?? undefined,
  timestamp: doc.timestamp.toISOString(),
});

export const createMongooseAgentActionLogRepository =
  (): AgentActionLogRepository => ({
    append: async (input: AgentActionLogCreateInput) => {
      const model = getAgentActionLogModel();
      const doc = new model({
        tenantId: input.tenantId,
        agentName: input.agentName,
        toolName: input.toolName,
        input: input.input,
        output: input.output,
        status: input.status,
        correlationId: input.correlationId,
        projectId: input.projectId,
        taskId: input.taskId,
      });
      await doc.save();
      return toLog(doc);
    },
    listByCorrelationId: async (tenantId, correlationId) => {
      const model = getAgentActionLogModel();
      const docs = await model
        .find({ tenantId, correlationId })
        .sort({ timestamp: -1 })
        .exec();
      return docs.map(toLog);
    },
  });
