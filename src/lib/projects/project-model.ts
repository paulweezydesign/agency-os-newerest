import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const projectSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    clientId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    budget: { type: Number, required: true, min: 0 },
    spend: { type: Number, required: true, min: 0, default: 0 },
    timelineStart: { type: String, required: true },
    timelineEnd: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

projectSchema.index({ tenantId: 1, clientId: 1 });
projectSchema.index({ tenantId: 1, _id: 1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

type ProjectModel = Model<ProjectDocument>;

const modelName = "Project";

export const getProjectModel = (): ProjectModel => {
  const existing = mongoose.models[modelName] as ProjectModel | undefined;
  return (
    existing ?? mongoose.model<ProjectDocument>(modelName, projectSchema)
  );
};
