import { describe, expect, it } from "vitest";
import {
  resolveDashboardAccessForRole,
  resolvePortalAccess,
} from "./portal-access";
import type { AuthSession } from "./session-context";

const clientSession: AuthSession = {
  user: {
    id: "user-client",
    role: "client",
    tenantId: "tenant-default",
  },
};

const operatorSession: AuthSession = {
  user: {
    id: "user-operator",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

describe("resolvePortalAccess", () => {
  it("allows client users with a linked clientId", () => {
    const access = resolvePortalAccess(
      clientSession,
      (userId) => (userId === "user-client" ? "client-1" : null),
    );

    expect(access).toEqual({
      status: "allow",
      context: {
        userId: "user-client",
        tenantId: "tenant-default",
        clientId: "client-1",
      },
    });
  });

  it("redirects operators away from the portal", () => {
    const access = resolvePortalAccess(operatorSession, () => "client-1");
    expect(access).toEqual({ status: "redirect", to: "/dashboard" });
  });

  it("redirects anonymous users to sign-in", () => {
    const access = resolvePortalAccess(null, () => "client-1");
    expect(access).toEqual({ status: "redirect", to: "/signin" });
  });
});

describe("resolveDashboardAccessForRole", () => {
  it("redirects client users to the portal", () => {
    expect(resolveDashboardAccessForRole(clientSession)).toEqual({
      status: "redirect",
      to: "/portal",
    });
  });

  it("allows operators on the dashboard", () => {
    expect(resolveDashboardAccessForRole(operatorSession)).toEqual({
      status: "allow",
    });
  });
});
