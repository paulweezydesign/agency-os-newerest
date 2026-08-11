export const DEFAULT_TENANT_ID = "tenant-default";

export type AppRole = "admin" | "agent-operator" | "client";

export type SeedUser = {
  id: string;
  email: string;
  password: string;
  role: AppRole;
  tenantId: string;
  name: string;
};

export const seedUsers: readonly SeedUser[] = [
  {
    id: "user-admin",
    email: "admin@agencyos.local",
    password: "admin-dev",
    role: "admin",
    tenantId: DEFAULT_TENANT_ID,
    name: "Agency Admin",
  },
  {
    id: "user-operator",
    email: "operator@agencyos.local",
    password: "operator-dev",
    role: "agent-operator",
    tenantId: DEFAULT_TENANT_ID,
    name: "Agent Operator",
  },
] as const;

export const findSeedUser = (
  email: string,
  password: string,
): SeedUser | undefined =>
  seedUsers.find(
    (user) => user.email === email && user.password === password,
  );
