import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const projectArtifactSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    kind: {
      type: String,
      required: true,
      enum: ["brief", "sow", "mvp_scaffold"],
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

projectArtifactSchema.index({ tenantId: 1, projectId: 1, createdAt: -1 });

export type ProjectArtifactDocument = InferSchemaType<
  typeof projectArtifactSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

type ProjectArtifactModel = Model<ProjectArtifactDocument>;

const modelName = "ProjectArtifact";

export const getProjectArtifactModel = (): ProjectArtifactModel => {
  const existing = mongoose.models[modelName] as
    | ProjectArtifactModel
    | undefined;
  return (
    existing ??
    mongoose.model<ProjectArtifactDocument>(modelName, projectArtifactSchema)
  );
};
