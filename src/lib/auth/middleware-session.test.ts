import { describe, expect, it } from "vitest";
import {
  resolveDashboardAccessForRole,
  resolvePortalAccess,
} from "./portal-access";
import { toMiddlewareAuthSession } from "./middleware-session";
import type {
  SessionAuthConfig,
  SignedSessionIdentity,
} from "./operator-identity";

const production: SessionAuthConfig = {
  environment: "production",
  demoFlag: "true", // An accidentally enabled flag must never activate demo accounts.
  adminIds: "42",
  operatorIds: "43",
};

const adminToken: SignedSessionIdentity = {
  authSource: "github",
  id: "github:42",
  role: "client", // A signed JWT role is not the current authorization policy.
  tenantId: "attacker-selected-tenant",
};

describe("middleware session authorization", () => {
  it("rejects requests without a signed session token", () => {
    const session = toMiddlewareAuthSession(null, production);
    expect(session).toBeNull();
    expect(resolveDashboardAccessForRole(session)).toEqual({
      status: "redirect",
      to: "/signin",
    });
    expect(resolvePortalAccess(session, () => "client-1")).toEqual({
      status: "redirect",
      to: "/signin",
    });
  });

  it("rejects a revoked GitHub account at the middleware boundary", () => {
    const config = { ...production, adminIds: "" };
    const session = toMiddlewareAuthSession(adminToken, config);
    expect(session).toBeNull();
    expect(resolveDashboardAccessForRole(session)).toEqual({
      status: "redirect",
      to: "/signin",
    });
    expect(resolvePortalAccess(session, () => "client-1")).toEqual({
      status: "redirect",
      to: "/signin",
    });
  });

  it("rederives admin role and tenant from the live allowlist", () => {
    const session = toMiddlewareAuthSession(adminToken, production);
    expect(session).toEqual({
      user: { id: "github:42", role: "admin", tenantId: "tenant-default" },
    });
    expect(resolveDashboardAccessForRole(session)).toEqual({
      status: "allow",
    });
    expect(resolvePortalAccess(session, () => "client-1")).toEqual({
      status: "redirect",
      to: "/dashboard",
    });
  });

  it("allows an approved agent operator but never grants client portal access", () => {
    const session = toMiddlewareAuthSession(
      { authSource: "github", id: "github:43", role: "admin" },
      production,
    );
    expect(session?.user.role).toBe("agent-operator");
    expect(resolveDashboardAccessForRole(session)).toEqual({
      status: "allow",
    });
    expect(resolvePortalAccess(session, () => "client-1")).toEqual({
      status: "redirect",
      to: "/dashboard",
    });
  });

  it("rejects tokens that only contain claims from the former middleware path", () => {
    const unvalidatedToken = {
      id: "github:42",
      sub: "github:42",
      role: "admin",
      tenantId: "tenant-default",
    } satisfies SignedSessionIdentity & { sub: string };
    expect(toMiddlewareAuthSession(unvalidatedToken, production)).toBeNull();
    // A token with the wrong sign-in origin must not be promoted to GitHub admin.
    expect(toMiddlewareAuthSession({ ...unvalidatedToken, authSource: "demo" }, production)).toBeNull();
  });

  it("never accepts a development-only client token in production", () => {
    const demoClient: SignedSessionIdentity = {
      authSource: "demo",
      id: "user-client",
      role: "client",
      tenantId: "tenant-default",
    };
    expect(toMiddlewareAuthSession(demoClient, production)).toBeNull();
    const devSession = toMiddlewareAuthSession(demoClient, {
      ...production,
      environment: "development",
    });
    expect(resolvePortalAccess(devSession, (id) => (
      id === "user-client" ? "client-1" : null
    ))).toEqual({
      status: "allow",
      context: {
        userId: "user-client",
        tenantId: "tenant-default",
        clientId: "client-1",
      },
    });
  });
});
