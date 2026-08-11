import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const agentActionLogSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    agentName: { type: String, required: true },
    toolName: { type: String, required: true },
    input: { type: Schema.Types.Mixed, required: true },
    output: { type: Schema.Types.Mixed, required: true },
    status: { type: String, required: true, enum: ["success", "error"] },
    correlationId: { type: String, required: true, index: true },
    projectId: { type: String },
    taskId: { type: String },
  },
  {
    timestamps: { createdAt: "timestamp", updatedAt: false },
  },
);

agentActionLogSchema.index({ tenantId: 1, correlationId: 1 });

export type AgentActionLogDocument = InferSchemaType<
  typeof agentActionLogSchema
> & {
  _id: mongoose.Types.ObjectId;
  timestamp: Date;
};

type AgentActionLogModel = Model<AgentActionLogDocument>;

const modelName = "AgentActionLog";

export const getAgentActionLogModel = (): AgentActionLogModel => {
  const existing = mongoose.models[modelName] as
    | AgentActionLogModel
    | undefined;
  return (
    existing ??
    mongoose.model<AgentActionLogDocument>(modelName, agentActionLogSchema)
  );
};
