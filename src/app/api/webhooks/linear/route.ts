import { areSyntheticWebhooksAllowed } from "@/lib/webhooks/runtime-policy";
import { NextResponse } from "next/server";
import { getLinearRuntime } from "@/lib/linear/get-linear-runtime";
import { handleLinearWebhook } from "@/lib/linear/linear-webhook-api";

export const POST = async (request: Request) => {
  if (!areSyntheticWebhooksAllowed()) {
    return NextResponse.json({ error: "Live webhooks are not configured" }, { status: 503 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleLinearWebhook({
    body,
    getRuntime: getLinearRuntime,
  });
  return NextResponse.json(result.body, { status: result.status });
};
