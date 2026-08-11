import { describe, expect, it } from "vitest";
import { resolveDashboardAccess } from "./dashboard-access";

describe("resolveDashboardAccess", () => {
  it("allows an authenticated operator into the dashboard", () => {
    const result = resolveDashboardAccess({
      userId: "user-1",
      role: "agent-operator",
      tenantId: "tenant-default",
    });

    expect(result).toEqual({ status: "allow" });
  });

  it("redirects unauthenticated visitors to sign-in", () => {
    const result = resolveDashboardAccess(null);

    expect(result).toEqual({
      status: "redirect",
      to: "/signin",
    });
  });
});
