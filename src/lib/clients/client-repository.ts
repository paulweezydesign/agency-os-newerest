import { randomUUID } from "node:crypto";
import type { Client } from "./schemas";

export type ClientRepository = {
  create: (input: { tenantId: string; name: string }) => Promise<Client>;
  listByTenant: (tenantId: string) => Promise<Client[]>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<Client | null>;
};

export const createInMemoryClientRepository = (): ClientRepository => {
  const clients: Client[] = [];

  return {
    create: async ({ tenantId, name }) => {
      const client: Client = {
        id: randomUUID(),
        tenantId,
        name,
        createdAt: new Date().toISOString(),
      };
      clients.push(client);
      return client;
    },
    listByTenant: async (tenantId) =>
      clients.filter((client) => client.tenantId === tenantId),
    getByTenantAndId: async (tenantId, id) =>
      clients.find(
        (client) => client.tenantId === tenantId && client.id === id,
      ) ?? null,
  };
};
