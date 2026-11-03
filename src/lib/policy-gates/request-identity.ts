import { createHash } from "node:crypto";
import type { PolicyGateCreateRecord } from "./policy-gate-repository";

// Canonicalize JSON objects so property order does not change replay identity.
export const fingerprint = (value: unknown): string => {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
};
export const gateRequestIdentity = (input: PolicyGateCreateRecord) =>
  input.requestKey
    ? {
        id: fingerprint([
          "policy-gate",
          input.tenantId,
          input.requestKey,
        ]).slice(0, 24),
        requestFingerprint: fingerprint(input),
      }
    : undefined;
