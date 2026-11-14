import { resolveOperatorApiAccess } from "./operator-api-access";
import { resolvePortalAccess } from "./portal-access";
import { findSeedClientIdForUser } from "./seed-users";
import type { AuthSession } from "./session-context";

type ApiSessionAccess = "operator" | "portal" | "operator-or-portal";
type ApiAccessError = {
  status: 401 | 403;
  body: { error: "Unauthorized" | "Forbidden" };
};

/**
 * Guard route-level dependency initialization with the existing session policies.
 * Handlers still enforce their own authorization and tenant/resource ownership.
 */
export const getApiSessionAccessError = (
  session: AuthSession,
  policy: ApiSessionAccess = "operator",
): ApiAccessError | null => {
  if (policy !== "portal") {
    const operator = resolveOperatorApiAccess(session);
    if (operator.status === "allow") return null;
    if (policy === "operator") {
      return operator.status === "unauthenticated"
        ? { status: 401, body: { error: "Unauthorized" } }
        : { status: 403, body: { error: "Forbidden" } };
    }
  }

  const portal = resolvePortalAccess(session, findSeedClientIdForUser);
  if (portal.status === "allow") return null;
  return portal.to === "/signin"
    ? { status: 401, body: { error: "Unauthorized" } }
    : { status: 403, body: { error: "Forbidden" } };
};
