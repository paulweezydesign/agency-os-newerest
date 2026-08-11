import type { ClientService } from "@/lib/clients/client-service";
import type { ProjectRepository } from "./project-repository";
import {
  createProjectInputSchema,
  type CreateProjectInput,
  type Project,
} from "./schemas";

export class ClientNotFoundError extends Error {
  constructor(message = "Client not found for tenant") {
    super(message);
    this.name = "ClientNotFoundError";
  }
}

export type ProjectService = {
  create: (
    input: CreateProjectInput & { tenantId: string; clientId: string },
  ) => Promise<Project>;
  listByClient: (tenantId: string, clientId: string) => Promise<Project[]>;
  get: (tenantId: string, id: string) => Promise<Project | null>;
};

export const createProjectService = (
  repository: ProjectRepository,
  clients: Pick<ClientService, "get">,
): ProjectService => ({
  create: async ({ tenantId, clientId, ...input }) => {
    const parsed = createProjectInputSchema.parse(input);
    const client = await clients.get(tenantId, clientId);

    if (!client) {
      throw new ClientNotFoundError();
    }

    return repository.create({
      tenantId,
      clientId,
      name: parsed.name,
      budget: parsed.budget,
      timelineStart: parsed.timelineStart,
      timelineEnd: parsed.timelineEnd,
    });
  },
  listByClient: (tenantId, clientId) =>
    repository.listByTenantAndClient(tenantId, clientId),
  get: (tenantId, id) => repository.getByTenantAndId(tenantId, id),
});
