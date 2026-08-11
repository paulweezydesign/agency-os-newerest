import { randomUUID } from "node:crypto";
import type { ChangeRequest, ChangeRequestStatus } from "./schemas";

export type ChangeRequestRepository = {
  create: (
    input: Omit<ChangeRequest, "id" | "createdAt" | "decidedAt">,
  ) => Promise<ChangeRequest>;
  listByProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<ChangeRequest[]>;
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<ChangeRequest | null>;
  update: (
    tenantId: string,
    id: string,
    patch: Partial<
      Pick<
        ChangeRequest,
        | "status"
        | "agencyApprovedBy"
        | "clientApprovedBy"
        | "decidedAt"
      >
    >,
  ) => Promise<ChangeRequest | null>;
};

export const createInMemoryChangeRequestRepository =
  (): ChangeRequestRepository => {
    const items: ChangeRequest[] = [];

    return {
      create: async (input) => {
        const entry: ChangeRequest = {
          id: randomUUID(),
          ...input,
          createdAt: new Date().toISOString(),
        };
        items.push(entry);
        return entry;
      },
      listByProject: async (tenantId, projectId) =>
        items.filter(
          (item) => item.tenantId === tenantId && item.projectId === projectId,
        ),
      getByTenantAndId: async (tenantId, id) =>
        items.find((item) => item.tenantId === tenantId && item.id === id) ??
        null,
      update: async (tenantId, id, patch) => {
        const item = items.find(
          (entry) => entry.tenantId === tenantId && entry.id === id,
        );
        if (!item) {
          return null;
        }
        Object.assign(item, patch);
        return item;
      },
    };
  };

export type { ChangeRequestStatus };
