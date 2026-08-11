import { describe, expect, it } from "vitest";
import { getSessionContext } from "./session-context";

describe("getSessionContext", () => {
  it("returns userId, role, and tenantId for an authenticated operator session", () => {
    const result = getSessionContext({
      user: {
        id: "user-1",
        role: "agent-operator",
        tenantId: "tenant-default",
      },
    });

    expect(result).toEqual({
      userId: "user-1",
      role: "agent-operator",
      tenantId: "tenant-default",
    });
  });

  it("accepts the admin role", () => {
    const result = getSessionContext({
      user: {
        id: "user-2",
        role: "admin",
        tenantId: "tenant-default",
      },
    });

    expect(result?.role).toBe("admin");
  });

  it("returns null when there is no session", () => {
    expect(getSessionContext(null)).toBeNull();
  });

  it("returns null when role is not an operator role", () => {
    const result = getSessionContext({
      user: {
        id: "user-3",
        role: "client",
        tenantId: "tenant-default",
      },
    });

    expect(result).toBeNull();
  });
});
