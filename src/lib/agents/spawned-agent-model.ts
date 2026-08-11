import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const spawnedAgentSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    specialization: { type: String, required: true },
    justification: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

spawnedAgentSchema.index({ tenantId: 1, projectId: 1 });

export type SpawnedAgentDocument = InferSchemaType<typeof spawnedAgentSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

type SpawnedAgentModel = Model<SpawnedAgentDocument>;

const modelName = "SpawnedAgent";

export const getSpawnedAgentModel = (): SpawnedAgentModel => {
  const existing = mongoose.models[modelName] as SpawnedAgentModel | undefined;
  return (
    existing ??
    mongoose.model<SpawnedAgentDocument>(modelName, spawnedAgentSchema)
  );
};
