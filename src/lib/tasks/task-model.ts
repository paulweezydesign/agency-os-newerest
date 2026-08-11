import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const taskSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true, default: "" },
    status: {
      type: String,
      required: true,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
    },
    assignee: { type: String, default: null },
    mondayItemId: { type: String, default: null, index: true },
    linearIssueId: { type: String, default: null, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

taskSchema.index({ tenantId: 1, projectId: 1 });
taskSchema.index({ tenantId: 1, _id: 1 });
taskSchema.index({ mondayItemId: 1 }, { sparse: true });
taskSchema.index({ linearIssueId: 1 }, { sparse: true });

export type TaskDocument = InferSchemaType<typeof taskSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

type TaskModel = Model<TaskDocument>;

const modelName = "Task";

export const getTaskModel = (): TaskModel => {
  const existing = mongoose.models[modelName] as TaskModel | undefined;
  return existing ?? mongoose.model<TaskDocument>(modelName, taskSchema);
};
