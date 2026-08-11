import type { ClientRepository } from "./client-repository";
import { createClientInputSchema, type Client } from "./schemas";

export type ClientService = {
  create: (input: {
    tenantId: string;
    name: string;
    id?: string;
  }) => Promise<Client>;
  list: (tenantId: string) => Promise<Client[]>;
  get: (tenantId: string, id: string) => Promise<Client | null>;
};

export const createClientService = (
  repository: ClientRepository,
): ClientService => ({
  create: async ({ tenantId, name, id }) => {
    const parsed = createClientInputSchema.parse({ name });
    return repository.create({ tenantId, name: parsed.name, id });
  },
  list: (tenantId) => repository.listByTenant(tenantId),
  get: (tenantId, id) => repository.getByTenantAndId(tenantId, id),
});
