import { gateRequestIdentity } from "./request-identity";
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
  executionState?: PolicyGate["executionState"] | null;
  claimToken?: string | null;
  claimedAt?: Date | null;
  requestKey?: string | null;
  requestFingerprint?: string | null;
  workflowRunId?: string | null;
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
  executionState: doc.executionState ?? undefined,
  claimToken: doc.claimToken ?? undefined,
  claimedAt: doc.claimedAt?.toISOString(),
  requestKey: doc.requestKey ?? undefined,
  requestFingerprint: doc.requestFingerprint ?? undefined,
  workflowRunId: doc.workflowRunId ?? undefined,
  effectRan: doc.effectRan,
  createdAt: doc.createdAt.toISOString(),
  decidedAt: doc.decidedAt?.toISOString(),
});

export const createMongoosePolicyGateRepository = (): PolicyGateRepository => ({
  create: async (input: PolicyGateCreateRecord) => {
    const model = getPolicyGateModel();
    const identity = gateRequestIdentity(input);
    if (identity) {
      let doc;
      try {
        doc = await model
          .findOneAndUpdate(
            { _id: identity.id },
            {
              $setOnInsert: {
                ...input,
                requestFingerprint: identity.requestFingerprint,
                status: "pending",
                effectRan: false,
              },
            },
            {
              upsert: true,
              returnDocument: "after",
              writeConcern: { w: "majority", j: true },
            },
          )
          .exec();
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        doc = await model.findById(identity.id).exec();
      }
      if (
        !doc ||
        doc.tenantId !== input.tenantId ||
        doc.requestFingerprint !== identity.requestFingerprint
      )
        throw new Error("Policy gate request key conflict");
      return toPolicyGate(doc);
    }
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
  claim: async (tenantId, id, decidedBy, claimToken) => {
    if (!/^[a-f\d]{24}$/i.test(id)) return null;
    const doc = await getPolicyGateModel()
      .findOneAndUpdate(
        {
          _id: id,
          tenantId,
          status: "pending",
          executionState: { $exists: false },
        },
        {
          $set: {
            executionState: "claimed",
            claimToken,
            decidedBy,
            claimedAt: new Date(),
          },
        },
        { returnDocument: "after", writeConcern: { w: "majority", j: true } },
      )
      .exec();
    return doc ? toPolicyGate(doc) : null;
  },
  markUncertain: async (tenantId, id, claimToken) => {
    await getPolicyGateModel()
      .updateOne(
        { _id: id, tenantId, claimToken, executionState: "claimed" },
        { $set: { executionState: "uncertain" } },
      )
      .exec();
  },
  applyDecision: async (tenantId, id, decision) => {
    if (decision.status === "approved" && !decision.claimToken) return null;
    const model = getPolicyGateModel();
    if (!id.match(/^[a-f\d]{24}$/i)) {
      return null;
    }
    const doc = await model
      .findOneAndUpdate(
        {
          _id: id,
          tenantId,
          status: "pending",
          ...(decision.status === "approved"
            ? { executionState: "claimed", claimToken: decision.claimToken }
            : { executionState: { $exists: false } }),
        },
        {
          ...(decision.status === "approved"
            ? { executionState: "completed" }
            : {}),
          status: decision.status,
          decidedBy: decision.decidedBy,
          effectRan: decision.effectRan,
          decidedAt: new Date(),
        },
        { returnDocument: "after", writeConcern: { w: "majority", j: true } },
      )
      .exec();
    return doc ? toPolicyGate(doc) : null;
  },
});
