import type { ClientRepository } from "./client-repository";
import {
  createClientInputSchema,
  updateClientPipelineInputSchema,
  type Client,
  type UpdateClientPipelineInput,
} from "./schemas";

export class ClientNotFoundError extends Error {
  constructor(message = "Client not found for tenant") {
    super(message);
    this.name = "ClientNotFoundError";
  }
}

export type ClientService = {
  create: (input: {
    tenantId: string;
    name: string;
    contactEmail?: string;
  }) => Promise<Client>;
  list: (tenantId: string) => Promise<Client[]>;
  get: (tenantId: string, id: string) => Promise<Client | null>;
  updatePipeline: (
    tenantId: string,
    id: string,
    input: UpdateClientPipelineInput,
  ) => Promise<Client>;
};

export const createClientService = (
  repository: ClientRepository,
): ClientService => ({
  create: async ({ tenantId, name, contactEmail }) => {
    const parsed = createClientInputSchema.parse({ name, contactEmail });
    return repository.create({
      tenantId,
      name: parsed.name,
      contactEmail: parsed.contactEmail,
    });
  },
  list: (tenantId) => repository.listByTenant(tenantId),
  get: (tenantId, id) => repository.getByTenantAndId(tenantId, id),
  updatePipeline: async (tenantId, id, input) => {
    const parsed = updateClientPipelineInputSchema.parse(input);
    const updated = await repository.updatePipeline(tenantId, id, parsed);
    if (!updated) {
      throw new ClientNotFoundError();
    }
    return updated;
  },
});
