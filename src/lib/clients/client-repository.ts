import { randomUUID } from "node:crypto";
import {
  DEFAULT_LEAD_SCORE,
  DEFAULT_PIPELINE_STAGE,
  type Client,
  type PipelineStage,
} from "./schemas";

export type CreateClientRecordInput = {
  tenantId: string;
  name: string;
  contactEmail?: string;
  pipelineStage?: PipelineStage;
  leadScore?: number;
};

export type UpdateClientPipelineRecordInput = {
  pipelineStage: PipelineStage;
  leadScore: number;
  contactEmail?: string;
};

export type ClientRepository = {
  create: (input: CreateClientRecordInput) => Promise<Client>;
  listByTenant: (tenantId: string) => Promise<Client[]>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<Client | null>;
  updatePipeline: (
    tenantId: string,
    id: string,
    input: UpdateClientPipelineRecordInput,
  ) => Promise<Client | null>;
};

export const createInMemoryClientRepository = (): ClientRepository => {
  const clients: Client[] = [];

  return {
    create: async ({
      tenantId,
      name,
      contactEmail,
      pipelineStage = DEFAULT_PIPELINE_STAGE,
      leadScore = DEFAULT_LEAD_SCORE,
    }) => {
      const client: Client = {
        id: randomUUID(),
        tenantId,
        name,
        contactEmail,
        pipelineStage,
        leadScore,
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
    updatePipeline: async (tenantId, id, input) => {
      const client = clients.find(
        (entry) => entry.tenantId === tenantId && entry.id === id,
      );
      if (!client) {
        return null;
      }

      client.pipelineStage = input.pipelineStage;
      client.leadScore = input.leadScore;
      if (input.contactEmail !== undefined) {
        client.contactEmail = input.contactEmail;
      }
      return client;
    },
  };
};
