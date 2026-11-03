import { getClientService } from "@/lib/clients/get-client-service";
import { syntheticEmailSchema } from "@/lib/policy-gates/dry-run-effects";
import mongoose from "mongoose";
import { MongoDBStore } from "@mastra/mongodb";
import { createMastraApp } from "@/mastra";
import { connectMongo } from "@/lib/db/mongodb";
import { fingerprint } from "@/lib/policy-gates/request-identity";
import { workflowInputSchema } from "@/mastra/workflows/client-pipeline";
import type { z } from "zod";

type RunInput = z.infer<typeof workflowInputSchema>;
type Admission = {
  _id: string;
  tenantId: string;
  clientId: string;
  correlationId: string;
  fingerprint: string;
  state: "running" | "suspended" | "success" | "uncertain";
  createdAt: Date;
  updatedAt: Date;
  phase: "start" | "resume";
};
export class WorkflowConflictError extends Error {}

export const createBetaWorkflowRuntime = async () => {
  if (
    process.env.AGENCYOS_BETA_WORKFLOW !== "dry-run" ||
    process.env.VERCEL_ENV === "production"
  )
    throw new WorkflowConflictError("Private beta workflow is disabled");
  await connectMongo();
  const db = mongoose.connection.db!;
  const admissions = db.collection<Admission>("client_pipeline_runs", {
    writeConcern: { w: "majority", j: true },
  });
  const storage = new MongoDBStore({
    id: "agencyos-mongo",
    uri: process.env.MONGODB_URI!,
    dbName: db.databaseName,
  });
  const app = createMastraApp({ storage });
  const workflow = app.getWorkflow("clientPipeline");
  const inspect = async (tenantId: string, clientId: string, runId: string) => {
    const record = await admissions.findOne({ _id: runId, tenantId, clientId });
    if (!record) throw new Error("Workflow run not found for tenant");
    const snapshot = await workflow.getWorkflowRunById(runId);
    return {
      runId,
      correlationId: record.correlationId,
      state: record.state,
      snapshot,
    };
  };
  const execute = async (input: RunInput, phase: "start" | "resume") => {
    try {
      const run = await workflow.createRun({
        runId: input.workflowRunId,
        resourceId: input.tenantId,
      });
      const result =
        phase === "start"
          ? await run.start({ inputData: input })
          : await run.resume({ step: "human-approval", resumeData: {} });
      const state =
        result.status === "success" || result.status === "suspended"
          ? result.status
          : "uncertain";
      // Verify a real snapshot exists before making this run resumable.
      const snapshot = await workflow.getWorkflowRunById(input.workflowRunId);
      if (!snapshot || snapshot.status !== result.status)
        throw new Error("Workflow snapshot persistence is uncertain");
      await admissions.updateOne(
        {
          _id: input.workflowRunId,
          tenantId: input.tenantId,
          state: "running",
        },
        { $set: { state, updatedAt: new Date() } },
      );
      return inspect(input.tenantId, input.clientId, input.workflowRunId);
    } catch (error) {
      await admissions
        .updateOne(
          {
            _id: input.workflowRunId,
            tenantId: input.tenantId,
            state: "running",
          },
          { $set: { state: "uncertain", updatedAt: new Date() } },
        )
        .catch(() => undefined);
      throw error;
    }
  };
  return {
    close: () => storage.close(),
    inspect,
    start: async (raw: RunInput) => {
      const input = workflowInputSchema.parse(raw);
      const client = await (
        await getClientService()
      ).get(input.tenantId, input.clientId);
      if (!client) throw new Error("Client not found for tenant");
      if (client.contactEmail) syntheticEmailSchema.parse(client.contactEmail);
      const digest = fingerprint(input);
      const now = new Date();
      try {
        await admissions.insertOne({
          _id: input.workflowRunId,
          tenantId: input.tenantId,
          clientId: input.clientId,
          correlationId: input.correlationId,
          fingerprint: digest,
          state: "running",
          phase: "start",
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        const previous = await admissions.findOne({
          _id: input.workflowRunId,
          tenantId: input.tenantId,
          clientId: input.clientId,
          fingerprint: digest,
        });
        if (!previous)
          throw new WorkflowConflictError("Workflow request key conflict");
        return inspect(input.tenantId, input.clientId, input.workflowRunId);
      }
      return execute(input, "start");
    },
    resume: async (tenantId: string, clientId: string, runId: string) => {
      const record = await admissions.findOneAndUpdate(
        { _id: runId, tenantId, clientId, state: "suspended" },
        { $set: { state: "running", phase: "resume", updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!record)
        throw new WorkflowConflictError("Workflow is not safely resumable");
      // Resume restores original inputs from the Mongo snapshot. Never accept a
      // browser-supplied tenant, score, approval boolean, or operator identity.
      return execute(
        {
          tenantId,
          clientId,
          workflowRunId: runId,
          correlationId: record.correlationId,
          leadScore: 0,
          requestedBy: "resume",
        },
        "resume",
      );
    },
  };
};
export type BetaWorkflowRuntime = Awaited<
  ReturnType<typeof createBetaWorkflowRuntime>
>;
