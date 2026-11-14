import type { DepositService } from "./deposit-service";
import type { StripeClient } from "./stripe-client";
import { StripeClientError } from "./stripe-client";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200; body: T }
  | { status: 400; body: ErrorBody };

export const handleStripeWebhook = async (input: {
  stripe: StripeClient;
  payload: string;
  signature: string;
} & ({ deposits: DepositService } | { getDeposits: () => Promise<DepositService> })): Promise<
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

    // Verify the event and metadata before initializing database-backed services.
    const deposits = "getDeposits" in input ? await input.getDeposits() : input.deposits;
    const result = await deposits.applyCheckoutCompleted({
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
