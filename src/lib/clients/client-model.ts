import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const clientSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    contactEmail: { type: String, required: false },
    pipelineStage: {
      type: String,
      required: true,
      default: "lead",
      enum: [
        "lead",
        "prospect",
        "qualify",
        "nurture",
        "onboard",
        "disqualified",
      ],
    },
    leadScore: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

clientSchema.index({ tenantId: 1, _id: 1 });

export type ClientDocument = InferSchemaType<typeof clientSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

type ClientModel = Model<ClientDocument>;

const modelName = "Client";

export const getClientModel = (): ClientModel => {
  const existing = mongoose.models[modelName] as ClientModel | undefined;
  return existing ?? mongoose.model<ClientDocument>(modelName, clientSchema);
};
