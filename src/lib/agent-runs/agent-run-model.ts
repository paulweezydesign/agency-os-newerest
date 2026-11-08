import mongoose, { Schema } from "mongoose";
import type { AgentRun } from "./schemas";
const schema = new Schema<AgentRun>({
  tenantId: { type: String, required: true },
  projectId: { type: String, required: true },
  runId: { type: String, required: true },
  actorId: { type: String, required: true },
  fixtureId: { type: String, required: true, enum: ["synthetic-brief-v1"] },
  modelId: { type: String, required: true },
  state: { type: String, required: true, enum: ["claimed", "task_created", "completed", "uncertain"] },
  taskId: { type: String, default: null },
  taskTitle: { type: String, default: null },
  taskDescription: { type: String, default: null },
  artifactId: { type: String, default: null },
}, { timestamps: true });
schema.index({ tenantId: 1, runId: 1 }, { unique: true });
schema.index({ tenantId: 1, projectId: 1 }, { unique: true });
export const getAgentRunModel = () =>
  (mongoose.models.AgentRun as mongoose.Model<AgentRun> | undefined) ??
  mongoose.model<AgentRun>("AgentRun", schema);
