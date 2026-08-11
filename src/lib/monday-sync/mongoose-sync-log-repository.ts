import type { SyncLogRepository } from "./sync-log-repository";
import type { SyncLog, SyncLogCreateInput } from "./sync-log-schemas";
import { getSyncLogModel } from "./sync-log-model";

const toSyncLog = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  taskId?: string | null;
  mondayItemId?: string | null;
  direction: SyncLog["direction"];
  outcome: SyncLog["outcome"];
  message: string;
  rejectedFields?: Array<"title" | "description"> | null;
  details?: unknown;
  createdAt: Date;
}): SyncLog => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  taskId: doc.taskId ?? undefined,
  mondayItemId: doc.mondayItemId ?? undefined,
  direction: doc.direction,
  outcome: doc.outcome,
  message: doc.message,
  rejectedFields: doc.rejectedFields ?? undefined,
  details: doc.details,
  createdAt: doc.createdAt.toISOString(),
});

export const createMongooseSyncLogRepository = (): SyncLogRepository => ({
  append: async (input: SyncLogCreateInput) => {
    const model = getSyncLogModel();
    const doc = await model.create(input);
    return toSyncLog(doc);
  },
  listByTenant: async (tenantId, limit = 50) => {
    const model = getSyncLogModel();
    const docs = await model
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return docs.map(toSyncLog);
  },
});
