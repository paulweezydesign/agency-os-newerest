import { DEFAULT_TENANT_ID, seedUsers, type AppRole } from "./seed-users";

export type GitHubOperator = {
  id: string;
  githubAccountId: string;
  role: "admin" | "agent-operator";
  tenantId: string;
};

const parseIds = (raw: string | undefined): Set<string> =>
  new Set((raw ?? "").split(",").map((id) => id.trim()).filter((id) => /^(0|[1-9][0-9]*)$/.test(id)));

export const isLocalDemoAuthEnabled = (environment: string | undefined, flag: string | undefined) =>
  environment === "development" && flag === "true";

export const isGitHubOAuthConfigured = (clientId: string | undefined, clientSecret: string | undefined) =>
  Boolean(clientId?.trim() && clientSecret?.trim());

export const resolveGitHubOperator = (
  accountId: string | undefined,
  adminAccountIds: string | undefined,
  operatorAccountIds: string | undefined,
): GitHubOperator | null => {
  if (!accountId || !/^(0|[1-9][0-9]*)$/.test(accountId)) return null;
  const admin = parseIds(adminAccountIds).has(accountId);
  const operator = parseIds(operatorAccountIds).has(accountId);
  if (!admin && !operator) return null;
  return {
    id: `github:${accountId}`,
    githubAccountId: accountId,
    role: admin ? "admin" : "agent-operator",
    tenantId: DEFAULT_TENANT_ID,
  };
};

export const safeSignInReturnPath = (target: string | undefined) => {
  if (!target || target.includes("..") || target.includes("\\") || target.includes("%") || target.includes("?") || target.includes("#")) return "/dashboard";
  if (/^\/dashboard(?:\/[-a-zA-Z0-9_/]*)?$/.test(target) || /^\/portal(?:\/[-a-zA-Z0-9_/]*)?$/.test(target)) return target;
  return "/dashboard";
};


export type SignedSessionIdentity = {
  id?: string;
  role?: AppRole;
  tenantId?: string;
  authSource?: "github" | "demo";
};

export type SessionAuthConfig = {
  environment: string | undefined;
  demoFlag: string | undefined;
  adminIds: string | undefined;
  operatorIds: string | undefined;
};

/**
 * The JWT is signed by Auth.js, but its role is never taken as authority.
 * Re-evaluate the configured operator allowlist for every session read.
 */
export const resolveActiveSessionIdentity = (
  token: SignedSessionIdentity,
  config: SessionAuthConfig,
): { id: string; role: AppRole; tenantId: string } | null => {
  if (token.authSource === "github") {
    const accountId = token.id?.match(/^github:([1-9][0-9]*)$/)?.[1];
    if (!accountId) return null;

    const operator = resolveGitHubOperator(
      accountId,
      config.adminIds,
      config.operatorIds,
    );
    if (!operator) return null;
    return { id: operator.id, role: operator.role, tenantId: operator.tenantId };
  }

  if (
    token.authSource === "demo" &&
    isLocalDemoAuthEnabled(config.environment, config.demoFlag)
  ) {
    // Local demo JWTs must still match a currently defined seed user.
    const seed = seedUsers.find(
      (user) =>
        user.id === token.id &&
        user.role === token.role &&
        user.tenantId === token.tenantId,
    );
    if (seed) return { id: seed.id, role: seed.role, tenantId: seed.tenantId };
  }

  return null;
};
