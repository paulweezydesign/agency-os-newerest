export type StripeCheckoutSession = {
  id: string;
  url: string;
  amount: number;
  currency: string;
  projectId: string;
  tenantId: string;
  status: "open" | "complete";
};

export type StripeWebhookEvent = {
  id: string;
  type: "checkout.session.completed";
  data: {
    object: {
      id: string;
      amount_total: number;
      currency: string;
      metadata: {
        projectId: string;
        tenantId: string;
        gateId?: string;
      };
    };
  };
};

export type StripeClient = {
  createCheckoutSession: (input: {
    tenantId: string;
    projectId: string;
    amount: number;
    currency?: string;
    gateId?: string;
  }) => Promise<StripeCheckoutSession>;
  constructWebhookEvent: (input: {
    payload: string;
    signature: string;
  }) => StripeWebhookEvent;
};

export class StripeClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeClientError";
  }
}

export type InMemoryStripeClient = StripeClient & {
  sessions: StripeCheckoutSession[];
  webhookSecret: string;
};

export const createInMemoryStripeClient = (
  webhookSecret = "whsec_test",
): InMemoryStripeClient => {
  const sessions: StripeCheckoutSession[] = [];
  let seq = 0;

  return {
    sessions,
    webhookSecret,
    createCheckoutSession: async ({
      tenantId,
      projectId,
      amount,
      currency = "usd",
      gateId,
    }) => {
      if (amount <= 0) {
        throw new StripeClientError("amount must be positive");
      }

      seq += 1;
      const session: StripeCheckoutSession = {
        id: `cs_test_${seq}`,
        url: `https://checkout.stripe.test/pay/cs_test_${seq}`,
        amount,
        currency,
        projectId,
        tenantId,
        status: "open",
      };
      sessions.push(session);
      // gateId reserved for metadata parity with real Stripe
      void gateId;
      return session;
    },
    constructWebhookEvent: ({ payload, signature }) => {
      if (signature !== webhookSecret) {
        throw new StripeClientError("Invalid webhook signature");
      }

      const parsed = JSON.parse(payload) as StripeWebhookEvent;
      if (parsed.type !== "checkout.session.completed") {
        throw new StripeClientError(`Unsupported event type: ${parsed.type}`);
      }
      return parsed;
    },
  };
};
