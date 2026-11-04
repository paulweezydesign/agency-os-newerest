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
    $set: { result: JSON.parse(JSON.stringify(result)), status: result.pendingEmailGates.length ? "awaiting_approval" : "completed" },
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
  const gates = await Promise.all((result?.pendingEmailGates ?? []).map(async (gate) => {
    const current = await gateRepository.getByTenantAndId(tenantId, gate.id);
    if (!current) throw new Error("Workflow approval record missing");
    return current;
  }));
  let status = record.status;
  if (result && gates.every((gate) => gate.status === "denied" || (gate.status === "approved" && gate.effectRan))) {
    status = "completed";
    await model.updateOne({ tenantId, runId }, { $set: { status } }).exec();
  }
  return workflowRunSchema.parse({
    tenantId,
    runId,
    clientId: record.clientId,
    correlationId: record.correlationId,
    mastraRunId: record.mastraRunId,
    status,
    checkpoints: record.checkpoints,
    result,
    gates,
    lastErrorCode: record.lastErrorCode,
  });
};

/** Runs real Mastra steps; Mongo application checkpoints are the recovery source
 * of truth. Engine-memory snapshots are not used as durable execution evidence. */
export const executeClientPipelineWorkflow = async (
  supplied: WorkflowInput,
): Promise<WorkflowRun> => {
  const input = workflowInputSchema.parse(supplied);
  // Preflight preserves typed validation/conflict errors at the HTTP boundary.
  const prepared = await prepareClientPipelineWorkflow(input);
  if (prepared.cachedResult || prepared.input.operatorId !== input.operatorId) {
    await createMongooseAgentActionLogRepository().append({
      tenantId: input.tenantId,
      agentName: input.operatorId,
      toolName: "clientPipeline.workflow.reentered",
      input: { runId: input.runId, clientId: input.clientId },
      output: { originalOperatorId: prepared.input.operatorId, dryRun: true },
      status: "success",
      correlationId: prepared.input.correlationId,
    });
  }
  if (prepared.cachedResult) {
    const cached = await getClientPipelineWorkflowRun(input.tenantId, input.runId);
    if (cached) return cached;
  }
  const { createMastraApp } = await import("@/mastra");
  const workflow = createMastraApp().getWorkflow("clientPipeline");
  const run = await workflow.createRun({ runId: engineRunId(input) });
  try {
    const execution = await run.start({ inputData: prepared.input });
    if (execution.status !== "success") throw new Error("Mastra workflow did not complete");
    return workflowRunSchema.parse(execution.result);
  } catch (error) {
    await getClientPipelineRunModel().updateOne({ ...key(input), result: { $exists: false } }, {
      $set: { status: "failed", lastErrorCode: "WORKFLOW_EXECUTION_FAILED" },
      $addToSet: { checkpoints: "execution-failed" },
    }).exec();
    throw error;
  }
};
