import {
  createInMemoryStripeClient,
  type StripeClient,
} from "./stripe-client";

let shared: StripeClient | null = null;

export const getStripeClient = (): StripeClient => {
  shared ??= createInMemoryStripeClient();
  return shared;
};

export const resetStripeClientForTests = (): void => {
  shared = null;
};
