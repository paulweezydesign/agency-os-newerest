import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const policyGateSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    actionType: {
      type: String,
      required: true,
      enum: ["client_email", "sow_send", "invoice_or_deposit"],
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "denied"],
      default: "pending",
    },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },
    projectId: { type: String, required: false },
    requestedBy: { type: String, required: true },
    decidedBy: { type: String, required: false },
    correlationId: { type: String, required: true },
    // Read old operator-branch claims conservatively; never re-claim these rows.
    executionState: { type: String, enum: ["claimed", "uncertain", "completed"] },
    effectRan: { type: Boolean, required: true, default: false },
    dryRun: { type: Boolean, default: false },
    requestKey: { type: String },
    effectStatus: {
      type: String,
      enum: ["idle", "running", "succeeded", "failed", "unknown"],
    },
    effectError: { type: String },
    effectReceipt: { type: Schema.Types.Mixed },
    decidedAt: { type: Date, required: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

policyGateSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
policyGateSchema.index(
  { tenantId: 1, requestKey: 1 },
  { unique: true, partialFilterExpression: { requestKey: { $type: "string" } } },
);

export type PolicyGateDocument = InferSchemaType<typeof policyGateSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

type PolicyGateModel = Model<PolicyGateDocument>;

const modelName = "PolicyGate";

export const getPolicyGateModel = (): PolicyGateModel => {
  const existing = mongoose.models[modelName] as PolicyGateModel | undefined;
  return (
    existing ??
    mongoose.model<PolicyGateDocument>(modelName, policyGateSchema)
  );
};
