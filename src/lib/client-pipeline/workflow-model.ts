import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const workflowRunSchema = new Schema({
  tenantId: { type: String, required: true },
  runId: { type: String, required: true },
  clientId: { type: String, required: true },
  correlationId: { type: String, required: true },
  mastraRunId: { type: String, required: true },
  input: { type: Schema.Types.Mixed, required: true },
  contactEmail: { type: String, required: true },
  status: { type: String, required: true, enum: ["running", "awaiting_approval", "completed", "failed"] },
  checkpoints: { type: [String], required: true, default: [] },
  result: { type: Schema.Types.Mixed },
  lastErrorCode: { type: String },
}, { timestamps: true });

workflowRunSchema.index({ tenantId: 1, runId: 1 }, { unique: true });
// This bounded slice permits one immutable scoring run per synthetic Client.
// A new score scenario uses a new synthetic Client, avoiding conflicting replays.
workflowRunSchema.index({ tenantId: 1, clientId: 1 }, { unique: true });

export type ClientPipelineRunDocument = InferSchemaType<typeof workflowRunSchema>;
type ClientPipelineRunModel = Model<ClientPipelineRunDocument>;

export const getClientPipelineRunModel = (): ClientPipelineRunModel =>
  (mongoose.models.ClientPipelineRun as ClientPipelineRunModel | undefined) ??
  mongoose.model<ClientPipelineRunDocument>("ClientPipelineRun", workflowRunSchema);
