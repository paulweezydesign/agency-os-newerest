import { NextResponse } from "next/server";
import { getLinearRuntime } from "@/lib/linear/get-linear-runtime";
import { handleLinearWebhook } from "@/lib/linear/linear-webhook-api";

export const POST = async (request: Request) => {
  const body: unknown = await request.json().catch(() => ({}));
  const { tasks, syncLogs } = await getLinearRuntime();
  const result = await handleLinearWebhook({
    body,
    tasks,
    syncLogs,
  });
  return NextResponse.json(result.body, { status: result.status });
};
