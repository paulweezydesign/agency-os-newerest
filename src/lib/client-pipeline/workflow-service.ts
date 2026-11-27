import { getPolicyGateModel } from "@/lib/policy-gates/policy-gate-model";
import { createHash } from "node:crypto";
import { connectMongo } from "@/lib/db/mongodb";
import { getClientService } from "@/lib/clients/get-client-service";
import { getClientModel } from "@/lib/clients/client-model";
import type { PipelineStage } from "@/lib/clients/schemas";
import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { createMongoosePolicyGateRepository } from "@/lib/policy-gates/mongoose-policy-gate-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import { createClientPipelineService } from "./client-pipeline-service";
import { getClientPipelineRunModel, type ClientPipelineRunDocument } from "./workflow-model";
import {
  gateIsTerminal,
  pipelineResultSchema,
  workflowInputSchema,
  workflowRunSchema,
  type WorkflowInput,
  type WorkflowPrepared,
  type WorkflowRouted,
  type WorkflowRun,
} from "./workflow-contract";

export { workflowInputSchema } from "./workflow-contract";
export type { WorkflowInput, WorkflowRun } from "./workflow-contract";

export class WorkflowRequestError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "WorkflowRequestError";
  }
}

const key = (input: Pick<WorkflowInput, "tenantId" | "runId">) => ({
  tenantId: input.tenantId,
  runId: input.runId,
});

const engineRunId = (input: WorkflowInput) =>
  createHash("sha256").update(JSON.stringify([input.tenantId, input.runId])).digest("hex");

const assertSameRequest = (stored: WorkflowInput, supplied: WorkflowInput) => {
  if (stored.clientId !== supplied.clientId || stored.leadScore !== supplied.leadScore) {
    throw new WorkflowRequestError(409, "Workflow run already exists with different input");
  }
};

const appendWorkflowAudit = async (input: WorkflowInput, checkpoint: string) =>
  createMongooseAgentActionLogRepository().append({
    tenantId: input.tenantId,
    agentName: input.operatorId,
    toolName: `clientPipeline.workflow.${checkpoint}`,
    input: { runId: input.runId, clientId: input.clientId, leadScore: input.leadScore },
    output: { mastraRunId: engineRunId(input), checkpoint, dryRun: true },
    status: "success",
    correlationId: input.correlationId,
  });

const reserveWorkflowClient = async (input: WorkflowInput, contactEmail: string) => {
  // The run is persisted first, so a crash here leaves recoverable immutable
  // input. The first legacy write and this reservation compete on one document.
  const owned = await getClientModel().findOneAndUpdate({
    _id: input.clientId,
    tenantId: input.tenantId,
    contactEmail,
    $or: [
      { workflowRunId: input.runId, leadScore: input.leadScore },
      { workflowRunId: { $exists: false }, pipelineStage: "lead", leadScore: 0 },
    ],
  }, { $set: { workflowRunId: input.runId, leadScore: input.leadScore } },
  { new: true, runValidators: true }).exec();
  if (!owned) {
    await getClientPipelineRunModel().updateOne({ ...key(input), result: { $exists: false } }, {
      $set: { status: "failed", lastErrorCode: "CLIENT_RESERVATION_CONFLICT" },
      $addToSet: { checkpoints: "client-reservation-conflict" },
    }).exec();
    const exists = await getClientModel().exists({ _id: input.clientId, tenantId: input.tenantId });
    throw new WorkflowRequestError(exists ? 409 : 404,
      exists ? "Client changed before workflow reservation or belongs to another run" : "Client not found for tenant");
  }
  await getClientPipelineRunModel().updateOne(key(input), {
    $addToSet: { checkpoints: "client-reserved" },
  }).exec();
};

const preparePersistedRun = async (
  record: ClientPipelineRunDocument,
  supplied: WorkflowInput,
): Promise<WorkflowPrepared> => {
  const original = workflowInputSchema.parse(record.input);
  assertSameRequest(original, supplied);
  await reserveWorkflowClient(original, record.contactEmail);
  return {
    input: original,
    contactEmail: record.contactEmail,
    cachedResult: record.result ? pipelineResultSchema.parse(record.result) : undefined,
  };
};

export const prepareClientPipelineWorkflow = async (
  supplied: WorkflowInput,
): Promise<WorkflowPrepared> => {
  const input = workflowInputSchema.parse(supplied);
  await connectMongo();
  const model = getClientPipelineRunModel();
  // The unique indexes are correctness requirements, including on a fresh DB.
  await model.init();
  let record = await model.findOne(key(input)).exec();
  if (record) {
    return preparePersistedRun(record, input);
  }

  const clients = await getClientService();
  const client = await clients.get(input.tenantId, input.clientId);
  if (!client) throw new WorkflowRequestError(404, "Client not found for tenant");
  if (!client.contactEmail || !/^[^@\s]+@[^@\s]+\.test$/i.test(client.contactEmail)) {
    throw new WorkflowRequestError(400, "A synthetic .test contact email is required");
  }
  if (client.pipelineStage !== "lead") {
    // Another request may have inserted this run and advanced the Client after
    // our first lookup. Re-read before rejecting a concurrent identical retry.
    const concurrent = await model.findOne(key(input)).exec();
    if (concurrent) {
      return preparePersistedRun(concurrent, input);
    }
    throw new WorkflowRequestError(409, "Create a new synthetic Client for a new scoring run");
  }

  try {
    record = await model.findOneAndUpdate(key(input), {
      $setOnInsert: {
        ...key(input),
        clientId: input.clientId,
        correlationId: input.correlationId,
        mastraRunId: engineRunId(input),
        input,
        contactEmail: client.contactEmail,
        status: "running",
        engineVersion: 1,
        engineState: "idle",
        checkpoints: ["input-persisted"],
      },
    }, { upsert: true, new: true }).exec();
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
    record = await model.findOne(key(input)).exec();
    if (!record) throw new WorkflowRequestError(409, "Client already has an immutable workflow run");
  }
  if (!record) throw new Error("Workflow input persistence failed");
  const prepared = await preparePersistedRun(record, input);
  await appendWorkflowAudit(prepared.input, "input-persisted");
  return prepared;
};

export const routeClientPipelineWorkflow = async (
  prepared: WorkflowPrepared,
): Promise<WorkflowRouted> => {
  const { input, contactEmail } = prepared;
  if (prepared.cachedResult) return { input, result: prepared.cachedResult };
  const clients = await getClientService();
  const actionLogs = createMongooseAgentActionLogRepository();
  const policyGates = createPolicyGateService(
    createMongoosePolicyGateRepository(),
    actionLogs,
    async () => { throw new Error("Live effects are disabled for synthetic workflows"); },
  );

  const pipeline = createClientPipelineService({
    clients: {
      ...clients,
      // Retried/concurrent execution advances the same immutable score. An old
      // invocation cannot regress a completed Client back to prospect/qualify.
      updatePipeline: async (tenantId, clientId, update) => {
        const earlierStages: PipelineStage[] = update.pipelineStage === "prospect"
          ? ["lead", "prospect"]
          : update.pipelineStage === "qualify"
            ? ["lead", "prospect", "qualify"]
            : ["lead", "prospect", "qualify", update.pipelineStage];
        await getClientModel().findOneAndUpdate({
          _id: clientId,
          tenantId,
          workflowRunId: input.runId,
          leadScore: input.leadScore,
          contactEmail,
          pipelineStage: { $in: earlierStages },
        }, { $set: update }, { runValidators: true }).exec();
        const owned = await getClientModel().exists({
          _id: clientId,
          tenantId,
          workflowRunId: input.runId,
          leadScore: input.leadScore,
          contactEmail,
        });
        if (!owned) throw new WorkflowRequestError(409, "Client workflow reservation no longer matches");
        const current = await clients.get(tenantId, clientId);
        if (!current) throw new WorkflowRequestError(404, "Client not found for tenant");
        return current;
      },
    },
    policyGates: {
      request: (request) => policyGates.request({
        ...request,
        dryRun: true,
        requestKey: `client-pipeline:${input.runId}`,
      }),
    },
  });
  const result = await pipeline.run({
    tenantId: input.tenantId,
    clientId: input.clientId,
    leadScore: input.leadScore,
    contactEmail,
    requestedBy: input.operatorId,
    correlationId: input.correlationId,
  });
  // These labels describe domain stages; no LLM/teammate invocation is claimed.
  result.steps = result.steps.map((step) => ({ ...step, note: `Workflow applied ${step.stage} using the existing pipeline service.` }));
  await getClientPipelineRunModel().updateOne(key(input), {
    $addToSet: { checkpoints: "scored-and-routed" },
  }).exec();
  await appendWorkflowAudit(input, "scored-and-routed");
  return { input, result };
};

export const completeClientPipelineWorkflow = async (
  routed: WorkflowRouted,
): Promise<WorkflowRun> => {
  const { input, result } = routed;
  await getClientPipelineRunModel().updateOne({
    ...key(input),
    result: { $exists: false },
  }, {
    // BSON Mixed fields otherwise turn explicit undefined optionals into null,
    // which changes their domain meaning and cannot round-trip through Zod.
    $set: { result: JSON.parse(JSON.stringify(result)), status: result.pendingEmailGates.length ? "awaiting_approval" : "running" },
    $unset: { lastErrorCode: "" },
    $addToSet: { checkpoints: "approval-boundary-persisted" },
  }).exec();
  await appendWorkflowAudit(input, "approval-boundary-persisted");
  const record = await getClientPipelineWorkflowRun(input.tenantId, input.runId);
  if (!record) throw new Error("Workflow checkpoint missing");
  return record;
};

export const getClientPipelineWorkflowRun = async (
  tenantId: string,
  runId: string,
): Promise<WorkflowRun | null> => {
  await connectMongo();
  const model = getClientPipelineRunModel();
  const record = await model.findOne({ tenantId, runId }).exec();
  if (!record) return null;
  const result = record.result ? pipelineResultSchema.parse(record.result) : undefined;
  const gateRepository = createMongoosePolicyGateRepository();
  const orphan = !result ? await getPolicyGateModel().findOne({ tenantId, requestKey: `client-pipeline:${runId}` }).exec() : null;
  const gateRefs = result?.pendingEmailGates ?? (orphan ? [{ id: orphan._id.toString() }] : []);
  const gates = await Promise.all(gateRefs.map(async (gate) => {
    const current = await gateRepository.getByTenantAndId(tenantId, gate.id);
    if (!current) throw new Error("Workflow approval record missing");
    return current;
  }));
  const status = record.status;
  return workflowRunSchema.parse({
    tenantId,
    runId,
    clientId: record.clientId,
    correlationId: record.correlationId,
    mastraRunId: record.mastraRunId,
    status,
    engineState: record.engineState,
    checkpoints: record.checkpoints,
    result,
    gates,
    lastErrorCode: record.lastErrorCode,
  });
};


/** The same PR30 admission owns both Client reservation and durable engine state. */
const withEngine = async <T>(work: (workflow: ReturnType<typeof import("@/mastra/workflows/client-pipeline").createClientPipelineWorkflow>) => Promise<T>) => {
  const { MongoDBStore } = await import("@mastra/mongodb");
  const { default: mongoose } = await import("mongoose");
  const { createMastraApp } = await import("@/mastra");
  await connectMongo();
  const storage = new MongoDBStore({ id: "agencyos-workflow-mongo", uri: process.env.MONGODB_URI!, dbName: mongoose.connection.db!.databaseName, options: { writeConcern: { w: "majority", j: true } } });
  try { return await work(createMastraApp({ storage }).getWorkflow("clientPipeline")); }
  finally { await storage.close(); }
};

const executeClaimedEngine = async (input: WorkflowInput, phase: "start" | "resume"): Promise<WorkflowRun> => {
  const model = getClientPipelineRunModel();
  try {
    await withEngine(async (workflow) => {
      const run = await workflow.createRun({ runId: engineRunId(input), resourceId: input.tenantId });
      const execution = phase === "start"
        ? await run.start({ inputData: input })
        : await run.resume({ step: "human-approval", resumeData: {} });
      if (execution.status !== "success" && execution.status !== "suspended") throw new Error("Engine outcome is not resumable");
      const snapshot = await workflow.getWorkflowRunById(engineRunId(input));
      if (!snapshot || snapshot.status !== execution.status) throw new Error("Durable engine snapshot unconfirmed");
      const updated = await model.updateOne({ ...key(input), engineState: "running" }, {
        $set: { engineState: execution.status, status: execution.status === "success" ? "completed" : "awaiting_approval" },
        $unset: { lastErrorCode: "" },
      }).exec();
      if (updated.matchedCount !== 1) throw new Error("Engine admission changed");
    });
    const record = await getClientPipelineWorkflowRun(input.tenantId, input.runId);
    if (!record) throw new Error("Workflow missing");
    return record;
  } catch (error) {
    await model.updateOne({ ...key(input), engineState: "running" }, {
      $set: { engineState: "uncertain", status: "failed", lastErrorCode: "ENGINE_OUTCOME_UNCONFIRMED" },
    }).exec().catch(() => undefined);
    throw error;
  }
};

export const executeClientPipelineWorkflow = async (supplied: WorkflowInput): Promise<WorkflowRun> => {
  const input = workflowInputSchema.parse(supplied);
  const prepared = await prepareClientPipelineWorkflow(input);
  const model = getClientPipelineRunModel();
  const claimed = await model.findOneAndUpdate({ ...key(input), engineVersion: 1, engineState: "idle" },
    { $set: { engineState: "running" } }, { new: true }).exec();
  if (!claimed) {
    const record = await getClientPipelineWorkflowRun(input.tenantId, input.runId);
    if (!record) throw new Error("Workflow missing");
    // Replays inspect existing execution. Never run.start again after a claim.
    return record;
  }
  return executeClaimedEngine(prepared.input, "start");
};

export const resumeClientPipelineWorkflow = async (tenantId: string, clientId: string, runId: string): Promise<WorkflowRun> => {
  const current = await getClientPipelineWorkflowRun(tenantId, runId);
  if (!current || current.clientId !== clientId) throw new WorkflowRequestError(404, "Workflow run not found");
  if (current.engineState !== "suspended" || !current.result || !current.gates.every(gateIsTerminal)) {
    throw new WorkflowRequestError(409, "Workflow is not safely resumable; inspect or explicitly recover its dry-run gate");
  }
  await withEngine(async (workflow) => {
    const snapshot = await workflow.getWorkflowRunById(current.mastraRunId);
    if (!snapshot || snapshot.status !== "suspended") throw new WorkflowRequestError(409, "Suspended engine snapshot unavailable");
  });
  const claimed = await getClientPipelineRunModel().findOneAndUpdate({ tenantId, clientId, runId, engineVersion: 1, engineState: "suspended" },
    { $set: { engineState: "running" } }, { new: true }).exec();
  if (!claimed) throw new WorkflowRequestError(409, "Workflow already claimed or blocked");
  return executeClaimedEngine(workflowInputSchema.parse(claimed.input), "resume");
};
