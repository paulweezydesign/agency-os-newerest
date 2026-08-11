import type { ClientRepository } from "./client-repository";
import { getClientModel } from "./client-model";
import {
  DEFAULT_LEAD_SCORE,
  DEFAULT_PIPELINE_STAGE,
  type Client,
  type PipelineStage,
} from "./schemas";

const toClient = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  name: string;
  contactEmail?: string | null;
  pipelineStage?: string | null;
  leadScore?: number | null;
  createdAt: Date;
}): Client => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  name: doc.name,
  contactEmail: doc.contactEmail ?? undefined,
  pipelineStage: (doc.pipelineStage as PipelineStage | null | undefined) ??
    DEFAULT_PIPELINE_STAGE,
  leadScore: doc.leadScore ?? DEFAULT_LEAD_SCORE,
  createdAt: doc.createdAt.toISOString(),
});

export const createMongooseClientRepository = (): ClientRepository => ({
  create: async ({
    tenantId,
    name,
    id,
    contactEmail,
    pipelineStage = DEFAULT_PIPELINE_STAGE,
    leadScore = DEFAULT_LEAD_SCORE,
  }) => {
    const model = getClientModel();
    const doc = await model.create(
      id
        ? {
            _id: id,
            tenantId,
            name,
            contactEmail,
            pipelineStage,
            leadScore,
          }
        : {
            tenantId,
            name,
            contactEmail,
            pipelineStage,
            leadScore,
          },
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
  updatePipeline: async (tenantId, id, input) => {
    const model = getClientModel();

    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }

    const doc = await model
      .findOneAndUpdate(
        { _id: id, tenantId },
        {
          pipelineStage: input.pipelineStage,
          leadScore: input.leadScore,
          ...(input.contactEmail !== undefined
            ? { contactEmail: input.contactEmail }
            : {}),
        },
        { new: true },
      )
      .exec();

    return doc ? toClient(doc) : null;
  },
});
