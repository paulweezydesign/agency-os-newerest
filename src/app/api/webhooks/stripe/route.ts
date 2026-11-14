import { areSyntheticWebhooksAllowed } from "@/lib/webhooks/runtime-policy";
import { NextResponse } from "next/server";
import { getDepositService } from "@/lib/stripe/get-deposit-service";
import { getStripeClient } from "@/lib/stripe/get-stripe-client";
import { handleStripeWebhook } from "@/lib/stripe/webhook-api";

export const POST = async (request: Request) => {
  if (!areSyntheticWebhooksAllowed()) {
    return NextResponse.json({ error: "Live webhooks are not configured" }, { status: 503 });
  }
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const result = await handleStripeWebhook({
    stripe: getStripeClient(),
    getDeposits: getDepositService,
    payload,
    signature,
  });

  return NextResponse.json(result.body, { status: result.status });
};
