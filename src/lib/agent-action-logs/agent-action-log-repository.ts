import { randomUUID } from "node:crypto";
import type { AgentActionLog, AgentActionLogCreateInput } from "./schemas";

export type AgentActionLogRepository = {
  append: (input: AgentActionLogCreateInput) => Promise<AgentActionLog>;
  listByCorrelationId: (
    tenantId: string,
    correlationId: string,
  ) => Promise<AgentActionLog[]>;
};

export const createInMemoryAgentActionLogRepository =
  (): AgentActionLogRepository => {
    const logs: AgentActionLog[] = [];

    return {
      append: async (input) => {
        const entry: AgentActionLog = {
          id: randomUUID(),
          ...input,
          timestamp: new Date().toISOString(),
        };
        logs.push(entry);
        return entry;
      },
      listByCorrelationId: async (tenantId, correlationId) =>
        logs.filter(
          (log) =>
            log.tenantId === tenantId && log.correlationId === correlationId,
        ),
    };
  };
