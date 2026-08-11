import { NextResponse } from "next/server";
import { getMondayRuntime } from "@/lib/monday-sync/get-monday-runtime";
import { handleMondayWebhook } from "@/lib/monday-sync/monday-webhook-api";

export const POST = async (request: Request) => {
  const body: unknown = await request.json().catch(() => ({}));
  const { tasks, syncLogs } = await getMondayRuntime();
  const result = await handleMondayWebhook({
    body,
    tasks,
    syncLogs,
  });
  return NextResponse.json(result.body, { status: result.status });
};
