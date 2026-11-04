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
  executionState?: string | null;
  dryRun?: boolean | null;
  requestKey?: string | null;
  effectStatus?: string | null;
  effectError?: string | null;
  effectReceipt?: PolicyGate["effectReceipt"] | null;
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
  executionState: doc.executionState as PolicyGate["executionState"] ?? undefined,
  dryRun: doc.dryRun ?? false,
  requestKey: doc.requestKey ?? undefined,
  effectStatus: (doc.effectStatus ?? (doc.effectRan ? "succeeded" : "idle")) as PolicyGate["effectStatus"],
  effectError: doc.effectError ?? undefined,
  effectReceipt: doc.effectReceipt ?? undefined,
  createdAt: doc.createdAt.toISOString(),
  decidedAt: doc.decidedAt?.toISOString(),
});

export const createMongoosePolicyGateRepository = (): PolicyGateRepository => ({
  create: async (input: PolicyGateCreateRecord) => {
    const model = getPolicyGateModel();
    // Wait for the unique request-key index before accepting retryable requests.
    await model.init();
    if (input.requestKey) {
      try {
        const doc = await model.findOneAndUpdate(
          { tenantId: input.tenantId, requestKey: input.requestKey },
          { $setOnInsert: { ...input, status: "pending", effectRan: false, effectStatus: "idle" } },
          { upsert: true, new: true, runValidators: true },
        ).exec();
        return toPolicyGate(doc);
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        const doc = await model.findOne({ tenantId: input.tenantId, requestKey: input.requestKey }).exec();
        if (!doc) throw error;
        return toPolicyGate(doc);
      }
    }
    const doc = await model.create({
      ...input,
      status: "pending",
      effectRan: false,
      effectStatus: "idle",
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
        { _id: id, tenantId, status: "pending", executionState: { $exists: false } },
        {
          status: decision.status,
          decidedBy: decision.decidedBy,
          effectRan: decision.effectRan,
          effectStatus: decision.status === "approved" ? "running" : "idle",
          decidedAt: new Date(),
        },
        { new: true },
      )
      .exec();
    return doc ? toPolicyGate(doc) : null;
  },
  completeDryRun: async (tenantId, id) => {
    if (!id.match(/^[a-f\d]{24}$/i)) return null;
    // Recording the dry-run receipt IS the effect. The one-document compare-and-set
    // makes both concurrent recovery and a lost response safe without a lease.
    const doc = await getPolicyGateModel().findOneAndUpdate(
      { _id: id, tenantId, status: "approved", dryRun: true, effectRan: false },
      { $set: { effectRan: true, effectStatus: "succeeded",
        effectReceipt: { key: `policy-gate:${id}`, mode: "dry-run", recordedAt: new Date().toISOString() } },
        $unset: { effectError: 1 } },
      { new: true },
    ).exec();
    return doc ? toPolicyGate(doc) : null;
  },
  completeEffect: async (tenantId, id) => {
    if (!id.match(/^[a-f\d]{24}$/i)) return null;
    const doc = await getPolicyGateModel().findOneAndUpdate(
      { _id: id, tenantId, status: "approved", effectStatus: "running", effectRan: false },
      { $set: { effectRan: true, effectStatus: "succeeded" } },
      { new: true },
    ).exec();
    return doc ? toPolicyGate(doc) : null;
  },
  failEffect: async (tenantId, id, status, errorCode) => {
    if (!id.match(/^[a-f\d]{24}$/i)) return;
    await getPolicyGateModel().updateOne(
      { _id: id, tenantId, status: "approved", effectRan: false },
      { $set: { effectStatus: status, effectError: errorCode } },
    ).exec();
  },
});
