import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const syncLogSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    taskId: { type: String },
    mondayItemId: { type: String },
    direction: {
      type: String,
      required: true,
      enum: ["outbound", "inbound"],
    },
    outcome: {
      type: String,
      required: true,
      enum: ["success", "conflict", "rejected-field"],
    },
    message: { type: String, required: true },
    rejectedFields: {
      type: [String],
      enum: ["title", "description"],
      default: undefined,
    },
    details: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

syncLogSchema.index({ tenantId: 1, createdAt: -1 });

export type SyncLogDocument = InferSchemaType<typeof syncLogSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

type SyncLogModel = Model<SyncLogDocument>;

const modelName = "MondaySyncLog";

export const getSyncLogModel = (): SyncLogModel => {
  const existing = mongoose.models[modelName] as SyncLogModel | undefined;
  return (
    existing ?? mongoose.model<SyncLogDocument>(modelName, syncLogSchema)
  );
};
