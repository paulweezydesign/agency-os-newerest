import type { SessionContext } from "./session-context";

export type DashboardAccess =
  | { status: "allow" }
  | { status: "redirect"; to: string };

export const resolveDashboardAccess = (
  context: SessionContext | null,
): DashboardAccess => {
  if (!context) {
    return { status: "redirect", to: "/signin" };
  }

  return { status: "allow" };
};
