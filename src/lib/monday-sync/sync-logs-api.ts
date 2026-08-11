import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import type { SyncLog } from "./sync-log-schemas";
import type { SyncLogRepository } from "./sync-log-repository";

type ErrorBody = { error: string };

export type SyncLogsApiResult =
  | { status: 200; body: SyncLog[] }
  | { status: 401 | 403; body: ErrorBody };

export const handleListSyncLogs = async ({
  session,
  syncLogs,
  limit,
}: {
  session: AuthSession;
  syncLogs: SyncLogRepository;
  limit?: number;
}): Promise<SyncLogsApiResult> => {
  const access = resolveOperatorApiAccess(session);

  switch (access.status) {
    case "unauthenticated":
      return { status: 401, body: { error: "Unauthorized" } };
    case "forbidden":
      return { status: 403, body: { error: "Forbidden" } };
    case "allow": {
      const logs = await syncLogs.listByTenant(access.context.tenantId, limit);
      return { status: 200, body: logs };
    }
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
};
