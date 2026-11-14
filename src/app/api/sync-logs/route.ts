import { getApiSessionAccessError } from "@/lib/auth/api-session-access";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getLinearRuntime } from "@/lib/linear/get-linear-runtime";
import { handleListSyncLogs } from "@/lib/linear/sync-logs-api";

export const GET = async () => {
  const session = toAuthSession(await auth());
  const accessError = getApiSessionAccessError(session);
  if (accessError) {
    return NextResponse.json(accessError.body, { status: accessError.status });
  }
  const { syncLogs } = await getLinearRuntime();
  const result = await handleListSyncLogs({ session, syncLogs });
  return NextResponse.json(result.body, { status: result.status });
};
