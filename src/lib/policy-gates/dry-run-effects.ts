import { z } from "zod";
import type { PolicyGateEffectRunner } from "./policy-gate-service";

export const syntheticEmailSchema = z
  .string()
  .email()
  .refine(
    (value) => value.toLowerCase().split("@")[1]?.endsWith(".test"),
    "Private beta requires a reserved .test contact",
  );

/** No provider adapters, fetch, SDKs, notifications, or delivery claims. */
export const runDryRunEffect: PolicyGateEffectRunner = async (input) => {
  if (input.actionType !== "client_email")
    throw new Error("Private beta only simulates client email");
  syntheticEmailSchema.parse(input.payload.to);
  return {
    mode: "dry-run",
    delivered: false,
    idempotencyKey: input.idempotencyKey,
  };
};
