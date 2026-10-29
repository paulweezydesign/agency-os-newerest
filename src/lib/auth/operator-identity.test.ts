import { describe, expect, it } from "vitest";
import {
  isLocalDemoAuthEnabled,
  isGitHubOAuthConfigured,
  resolveGitHubOperator,
  safeSignInReturnPath,
  resolveActiveSessionIdentity,
} from "./operator-identity";

describe("private-beta authentication policy", () => {
  it("does not permit demo passwords in production even if flagged on", () => {
    expect(isLocalDemoAuthEnabled("production", "true")).toBe(false);
  });

  it("requires explicit opt-in for demo credentials and local development", () => {
    expect(isLocalDemoAuthEnabled("development", undefined)).toBe(false);
    expect(isLocalDemoAuthEnabled("development", "false")).toBe(false);
    expect(isLocalDemoAuthEnabled("development", "true")).toBe(true);
    expect(isLocalDemoAuthEnabled("test", "true")).toBe(false);
  });

  it("only enables GitHub sign-in when both OAuth credentials are configured", () => {
    expect(isGitHubOAuthConfigured(undefined, undefined)).toBe(false);
    expect(isGitHubOAuthConfigured("id", undefined)).toBe(false);
    expect(isGitHubOAuthConfigured(" ", "secret")).toBe(false);
    expect(isGitHubOAuthConfigured("client-id", "client-secret")).toBe(true);
  });

  it("denies an unknown GitHub identity even if it has the correct email", () => {
    expect(resolveGitHubOperator("99", "42", "43")).toBeNull();
    expect(resolveGitHubOperator(undefined, "42", "43")).toBeNull();
    expect(resolveGitHubOperator("alice@example.com", "alice@example.com", "")).toBeNull();
  });

  it("authorizes immutable GitHub account IDs for the single tenant", () => {
    expect(resolveGitHubOperator("42", " 42, 86 ", "")).toEqual({
      id: "github:42",
      githubAccountId: "42",
      role: "admin",
      tenantId: "tenant-default",
    });
    expect(resolveGitHubOperator("43", "", "42, 43")).toEqual({
      id: "github:43",
      githubAccountId: "43",
      role: "agent-operator",
      tenantId: "tenant-default",
    });
  });

  it("gives admin priority if an ID appears in both configured lists", () => {
    expect(resolveGitHubOperator("42", "42", "42")?.role).toBe("admin");
  });

  it("allows immediate revocation by changing the allowlist", () => {
    expect(resolveGitHubOperator("42", "42", "")?.role).toBe("admin");
    expect(resolveGitHubOperator("42", "", "")).toBeNull();
  });

  it("rejects malformed account ID strings and inconsistent allowlists", () => {
    expect(resolveGitHubOperator("042", "042", "")).toBeNull();
    expect(resolveGitHubOperator("42", "user-42", "")).toBeNull();
    expect(resolveGitHubOperator("42 ", "42", "")).toBeNull();
  });

  it("does not allow external or unexpected sign-in redirect destinations", () => {
    expect(safeSignInReturnPath("/dashboard")).toBe("/dashboard");
    expect(safeSignInReturnPath("/dashboard/clients")).toBe("/dashboard/clients");
    expect(safeSignInReturnPath("/portal")).toBe("/portal");
    expect(safeSignInReturnPath("https://example.com")).toBe("/dashboard");
    expect(safeSignInReturnPath("//example.com")).toBe("/dashboard");
    expect(safeSignInReturnPath("/api/policy-gates")).toBe("/dashboard");
    expect(safeSignInReturnPath("/dashboard/../../evil")).toBe("/dashboard");
  });
});

describe("active session validation", () => {
  const config = {
    environment: "production",
    demoFlag: "true",
    adminIds: "42",
    operatorIds: "43",
  };
  it("authorizes an allowed GitHub account without trusting JWT role claims", () => {
    expect(resolveActiveSessionIdentity({
      authSource: "github", id: "github:42", role: "client", tenantId: "other",
    }, config)).toEqual({ id: "github:42", role: "admin", tenantId: "tenant-default" });
  });
  it("revokes GitHub access after allowlist removal", () => {
    expect(resolveActiveSessionIdentity({ authSource: "github", id: "github:42" }, {
      ...config, adminIds: "",
    })).toBeNull();
  });
  it("denies malformed and unknown session origins", () => {
    expect(resolveActiveSessionIdentity({ authSource: "github", id: "github:0" }, config)).toBeNull();
    expect(resolveActiveSessionIdentity({ authSource: "github", id: "github:bad" }, config)).toBeNull();
    expect(resolveActiveSessionIdentity({ id: "github:42" }, config)).toBeNull();
  });
  it("cannot re-enable demo credentials in production", () => {
    expect(resolveActiveSessionIdentity({
      authSource: "demo", id: "user-admin", role: "admin", tenantId: "tenant-default",
    }, config)).toBeNull();
  });
  it("accepts a valid demo user only in explicitly opted-in development mode", () => {
    expect(resolveActiveSessionIdentity({
      authSource: "demo", id: "user-admin", role: "admin", tenantId: "tenant-default",
    }, { ...config, environment: "development" })).toEqual({
      id: "user-admin", role: "admin", tenantId: "tenant-default",
    });
    expect(resolveActiveSessionIdentity({
      authSource: "demo", id: "user-admin", role: "admin", tenantId: "different",
    }, { ...config, environment: "development" })).toBeNull();
  });
});
