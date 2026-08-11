export type OperatorRole = "admin" | "agent-operator";

export type SessionUser = {
  id: string;
  role: string;
  tenantId: string;
};

export type AuthSession = {
  user: SessionUser;
} | null;

export type SessionContext = {
  userId: string;
  role: OperatorRole;
  tenantId: string;
};

const isOperatorRole = (role: string): role is OperatorRole =>
  role === "admin" || role === "agent-operator";

export const getSessionContext = (
  session: AuthSession,
): SessionContext | null => {
  if (!session?.user) {
    return null;
  }

  const { id, role, tenantId } = session.user;

  if (!id || !tenantId || !isOperatorRole(role)) {
    return null;
  }

  return {
    userId: id,
    role,
    tenantId,
  };
};
