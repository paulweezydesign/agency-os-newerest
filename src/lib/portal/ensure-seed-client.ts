import {
  DEFAULT_TENANT_ID,
  SEED_CLIENT_ID,
} from "@/lib/auth/seed-users";
import type { ClientService } from "@/lib/clients/client-service";
import type { Client } from "@/lib/clients/schemas";

export const ensureSeedPortalClient = async (
  clients: ClientService,
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<Client> => {
  const existing = await clients.get(tenantId, SEED_CLIENT_ID);
  if (existing) {
    return existing;
  }

  return clients.create({
    tenantId,
    id: SEED_CLIENT_ID,
    name: "Acme Co",
  });
};
