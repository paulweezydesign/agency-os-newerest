import {
  resolveActiveSessionIdentity,
  type SessionAuthConfig,
  type SignedSessionIdentity,
} from "./operator-identity";
import type { AuthSession } from "./session-context";

/**
 * Middleware must apply the same live allowlist policy as the Auth.js session
 * callback. Never treat role/tenant values stored in a signed JWT as current
 * authorization, and never fall back to the JWT subject as an operator ID.
 */
export const toMiddlewareAuthSession = (
  token: SignedSessionIdentity | null,
  config: SessionAuthConfig,
): AuthSession => {
  if (!token) return null;

  const identity = resolveActiveSessionIdentity(token, config);
  if (!identity) return null;

  return { user: identity };
};
