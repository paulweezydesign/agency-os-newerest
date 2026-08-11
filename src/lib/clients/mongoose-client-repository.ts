import type { ClientRepository } from "./client-repository";
import { getClientModel } from "./client-model";
import type { Client } from "./schemas";

const toClient = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  name: string;
  createdAt: Date;
}): Client => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  name: doc.name,
  createdAt: doc.createdAt.toISOString(),
});

export const createMongooseClientRepository = (): ClientRepository => ({
  create: async ({ tenantId, name, id }) => {
    const model = getClientModel();
    const doc = await model.create(
      id ? { _id: id, tenantId, name } : { tenantId, name },
    );
    return toClient(doc);
  },
  listByTenant: async (tenantId) => {
    const model = getClientModel();
    const docs = await model.find({ tenantId }).sort({ createdAt: -1 }).exec();
    return docs.map(toClient);
  },
  getByTenantAndId: async (tenantId, id) => {
    const model = getClientModel();

    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }

    const doc = await model.findOne({ _id: id, tenantId }).exec();
    return doc ? toClient(doc) : null;
  },
});
