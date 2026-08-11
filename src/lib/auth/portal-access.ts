import type { AuthSession } from "./session-context";

export type PortalContext = {
  userId: string;
  tenantId: string;
  clientId: string;
};

export type PortalAccess =
  | { status: "allow"; context: PortalContext }
  | { status: "redirect"; to: string };

export type ClientSeedLink = {
  userId: string;
  clientId: string;
};

/**
 * Resolve portal access for a Client-role session.
 * `clientId` comes from the seed user link (or JWT later).
 */
export const resolvePortalAccess = (
  session: AuthSession,
  clientIdForUser: (userId: string) => string | null,
): PortalAccess => {
  if (!session?.user) {
    return { status: "redirect", to: "/signin" };
  }

  if (session.user.role !== "client") {
    return { status: "redirect", to: "/dashboard" };
  }

  const clientId = clientIdForUser(session.user.id);
  if (!clientId) {
    return { status: "redirect", to: "/signin" };
  }

  return {
    status: "allow",
    context: {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      clientId,
    },
  };
};

export const resolveDashboardAccessForRole = (
  session: AuthSession,
): PortalAccess | { status: "allow" } => {
  if (!session?.user) {
    return { status: "redirect", to: "/signin" };
  }

  if (session.user.role === "client") {
    return { status: "redirect", to: "/portal" };
  }

  if (
    session.user.role !== "admin" &&
    session.user.role !== "agent-operator"
  ) {
    return { status: "redirect", to: "/signin" };
  }

  return { status: "allow" };
};
