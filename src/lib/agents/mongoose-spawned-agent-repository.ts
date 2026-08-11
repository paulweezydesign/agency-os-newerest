import type {
  SpawnedAgent,
  SpawnedAgentCreateRecord,
  SpawnedAgentRepository,
} from "./spawned-agent-repository";
import { getSpawnedAgentModel } from "./spawned-agent-model";

const toPublicId = (mongoId: string): string =>
  mongoId.startsWith("spawned:") ? mongoId : `spawned:${mongoId}`;

const toMongoId = (publicId: string): string =>
  publicId.startsWith("spawned:") ? publicId.slice("spawned:".length) : publicId;

const toSpawnedAgent = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  projectId: string;
  specialization: string;
  justification: string;
  createdBy: string;
  createdAt: Date;
}): SpawnedAgent => ({
  id: toPublicId(doc._id.toString()),
  tenantId: doc.tenantId,
  projectId: doc.projectId,
  specialization: doc.specialization,
  justification: doc.justification,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt.toISOString(),
});

export const createMongooseSpawnedAgentRepository =
  (): SpawnedAgentRepository => ({
    create: async (input: SpawnedAgentCreateRecord) => {
      const model = getSpawnedAgentModel();
      const doc = await model.create(input);
      return toSpawnedAgent(doc);
    },
    listByTenantAndProject: async (tenantId, projectId) => {
      const model = getSpawnedAgentModel();
      const docs = await model
        .find({ tenantId, projectId })
        .sort({ createdAt: -1 })
        .exec();
      return docs.map(toSpawnedAgent);
    },
    countByTenantAndProject: async (tenantId, projectId) => {
      const model = getSpawnedAgentModel();
      return model.countDocuments({ tenantId, projectId }).exec();
    },
    getByTenantAndId: async (tenantId, id) => {
      const model = getSpawnedAgentModel();
      const mongoId = toMongoId(id);

      if (!mongoId.match(/^[a-f\d]{24}$/i)) {
        return null;
      }

      const doc = await model.findOne({ _id: mongoId, tenantId }).exec();
      return doc ? toSpawnedAgent(doc) : null;
    },
  });
