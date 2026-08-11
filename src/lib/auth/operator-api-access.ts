import {
  getSessionContext,
  type AuthSession,
  type SessionContext,
} from "./session-context";

export type OperatorApiAccess =
  | { status: "allow"; context: SessionContext }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

export const resolveOperatorApiAccess = (
  session: AuthSession,
): OperatorApiAccess => {
  if (!session?.user) {
    return { status: "unauthenticated" };
  }

  const context = getSessionContext(session);

  if (!context) {
    return { status: "forbidden" };
  }

  return { status: "allow", context };
};
