import { areSyntheticWebhooksAllowed } from "@/lib/webhooks/runtime-policy";
import { NextResponse } from "next/server";
import { getMondayRuntime } from "@/lib/monday-sync/get-monday-runtime";
import { handleMondayWebhook } from "@/lib/monday-sync/monday-webhook-api";

export const POST = async (request: Request) => {
  if (!areSyntheticWebhooksAllowed()) {
    return NextResponse.json({ error: "Live webhooks are not configured" }, { status: 503 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleMondayWebhook({
    body,
    getRuntime: getMondayRuntime,
  });
  return NextResponse.json(result.body, { status: result.status });
};
