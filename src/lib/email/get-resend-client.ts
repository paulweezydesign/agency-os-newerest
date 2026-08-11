import {
  createInMemoryResendClient,
  type ResendClient,
} from "./resend-client";

let shared: ResendClient | null = null;

/**
 * v1 uses an in-memory Resend client so approve-path demos work without keys.
 * Swap for a real HTTP client when RESEND_API_KEY is configured in later work.
 */
export const getResendClient = (): ResendClient => {
  shared ??= createInMemoryResendClient();
  return shared;
};
