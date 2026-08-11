import type {
  PolicyGateCreateRecord,
  PolicyGateRepository,
} from "./policy-gate-repository";
import { getPolicyGateModel } from "./policy-gate-model";
import type { PolicyGate } from "./schemas";

const toPolicyGate = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  actionType: PolicyGate["actionType"];
  status: PolicyGate["status"];
  payload: Record<string, unknown>;
  projectId?: string | null;
  requestedBy: string;
  decidedBy?: string | null;
  correlationId: string;
  effectRan: boolean;
  createdAt: Date;
  decidedAt?: Date | null;
}): PolicyGate => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  actionType: doc.actionType,
  status: doc.status,
  payload: doc.payload ?? {},
  projectId: doc.projectId ?? undefined,
  requestedBy: doc.requestedBy,
  decidedBy: doc.decidedBy ?? undefined,
  correlationId: doc.correlationId,
  effectRan: doc.effectRan,
  createdAt: doc.createdAt.toISOString(),
  decidedAt: doc.decidedAt?.toISOString(),
});

export const createMongoosePolicyGateRepository = (): PolicyGateRepository => ({
  create: async (input: PolicyGateCreateRecord) => {
    const model = getPolicyGateModel();
    const doc = await model.create({
      ...input,
      status: "pending",
      effectRan: false,
    });
    return toPolicyGate(doc);
  },
  getByTenantAndId: async (tenantId, id) => {
    const model = getPolicyGateModel();
    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }
    const doc = await model.findOne({ _id: id, tenantId }).exec();
    return doc ? toPolicyGate(doc) : null;
  },
  listByTenant: async (tenantId, limit = 50) => {
    const model = getPolicyGateModel();
    const docs = await model
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return docs.map(toPolicyGate);
  },
  listPendingByTenant: async (tenantId) => {
    const model = getPolicyGateModel();
    const docs = await model
      .find({ tenantId, status: "pending" })
      .sort({ createdAt: 1 })
      .exec();
    return docs.map(toPolicyGate);
  },
  applyDecision: async (tenantId, id, decision) => {
    const model = getPolicyGateModel();
    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }
    const doc = await model
      .findOneAndUpdate(
        { _id: id, tenantId, status: "pending" },
        {
          status: decision.status,
          decidedBy: decision.decidedBy,
          effectRan: decision.effectRan,
          decidedAt: new Date(),
        },
        { new: true },
      )
      .exec();
    return doc ? toPolicyGate(doc) : null;
  },
});
