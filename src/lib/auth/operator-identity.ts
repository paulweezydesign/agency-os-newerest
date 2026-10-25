import { DEFAULT_TENANT_ID } from "./seed-users";

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
