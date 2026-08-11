export const DEFAULT_TENANT_ID = "tenant-default";

/** Stable demo Client ObjectId used by the seed client portal user. */
export const SEED_CLIENT_ID = "507f1f77bcf86cd7994390aa";

export type AppRole = "admin" | "agent-operator" | "client";

export type SeedUser = {
  id: string;
  email: string;
  password: string;
  role: AppRole;
  tenantId: string;
  name: string;
  clientId?: string;
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
  {
    id: "user-client",
    email: "client@agencyos.local",
    password: "client-dev",
    role: "client",
    tenantId: DEFAULT_TENANT_ID,
    name: "Acme Client",
    clientId: SEED_CLIENT_ID,
  },
] as const;

export const findSeedUser = (
  email: string,
  password: string,
): SeedUser | undefined =>
  seedUsers.find(
    (user) => user.email === email && user.password === password,
  );

export const findSeedClientIdForUser = (userId: string): string | null =>
  seedUsers.find((user) => user.id === userId)?.clientId ?? null;
