import { randomUUID } from "node:crypto";
import type { SlackNotifier, SyncFailureLog } from "./notify";

type SyncLogRepositoryLike<TLog extends SyncFailureLog & { tenantId: string }, TInput> =
  {
    append: (input: TInput) => Promise<TLog>;
    listByTenant: (tenantId: string, limit?: number) => Promise<TLog[]>;
  };

/** Wraps a sync-log repository and notifies Slack on non-success outcomes. */
export const createNotifyingSyncLogRepository = <
  TLog extends SyncFailureLog & { tenantId: string },
  TInput,
>(
  inner: SyncLogRepositoryLike<TLog, TInput>,
  notifier: Pick<SlackNotifier, "notifySyncFailure">,
  tracker: "monday" | "linear",
): SyncLogRepositoryLike<TLog, TInput> => ({
  append: async (input) => {
    const log = await inner.append(input);

    if (log.outcome !== "success") {
      await notifier.notifySyncFailure({
        tenantId: log.tenantId,
        tracker,
        log,
        correlationId: randomUUID(),
      });
    }

    return log;
  },
  listByTenant: (tenantId, limit) => inner.listByTenant(tenantId, limit),
});
