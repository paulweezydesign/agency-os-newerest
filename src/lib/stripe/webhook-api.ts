import type { DepositService } from "./deposit-service";
import type { StripeClient } from "./stripe-client";
import { StripeClientError } from "./stripe-client";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200; body: T }
  | { status: 400; body: ErrorBody };

export const handleStripeWebhook = async (input: {
  stripe: StripeClient;
  deposits: DepositService;
  payload: string;
  signature: string;
}): Promise<
  ApiResult<{ received: true; projectId: string; depositTotal: number }>
> => {
  try {
    const event = input.stripe.constructWebhookEvent({
      payload: input.payload,
      signature: input.signature,
    });

    const session = event.data.object;
    const { projectId, tenantId } = session.metadata;
    const amount = session.amount_total;

    if (!projectId || !tenantId || !(amount > 0)) {
      return { status: 400, body: { error: "Invalid checkout metadata" } };
    }

    const result = await input.deposits.applyCheckoutCompleted({
      tenantId,
      projectId,
      amount,
      sessionId: session.id,
    });

    return {
      status: 200,
      body: {
        received: true,
        projectId: result.projectId,
        depositTotal: result.depositTotal,
      },
    };
  } catch (error) {
    if (error instanceof StripeClientError) {
      return { status: 400, body: { error: error.message } };
    }
    throw error;
  }
};
