import type { AuthSession } from "./session-context";

type SessionLike = {
  user?: {
    id?: string | null;
    role?: string | null;
    tenantId?: string | null;
  } | null;
} | null;

export const toAuthSession = (session: SessionLike): AuthSession => {
  if (!session?.user?.id || !session.user.role || !session.user.tenantId) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      role: session.user.role,
      tenantId: session.user.tenantId,
    },
  };
};
