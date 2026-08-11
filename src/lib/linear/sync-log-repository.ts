import { randomUUID } from "node:crypto";
import type { SyncLog, SyncLogCreateInput } from "./sync-log-schemas";

export type SyncLogRepository = {
  append: (input: SyncLogCreateInput) => Promise<SyncLog>;
  listByTenant: (tenantId: string, limit?: number) => Promise<SyncLog[]>;
};

export const createInMemorySyncLogRepository = (): SyncLogRepository => {
  const logs: SyncLog[] = [];

  return {
    append: async (input) => {
      const entry: SyncLog = {
        id: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      };
      logs.unshift(entry);
      return entry;
    },
    listByTenant: async (tenantId, limit = 50) =>
      logs.filter((log) => log.tenantId === tenantId).slice(0, limit),
  };
};
