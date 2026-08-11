import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getMondayRuntime } from "@/lib/monday-sync/get-monday-runtime";
import { handleListSyncLogs } from "@/lib/monday-sync/sync-logs-api";

export const GET = async () => {
  const session = toAuthSession(await auth());
  const { syncLogs } = await getMondayRuntime();
  const result = await handleListSyncLogs({ session, syncLogs });
  return NextResponse.json(result.body, { status: result.status });
};
