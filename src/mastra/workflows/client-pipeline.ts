import { MongoDBStore } from "@mastra/mongodb";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { ClientPipelineService } from "@/lib/client-pipeline/client-pipeline-service";
import { clientSchema, pipelineStageSchema } from "@/lib/clients/schemas";
import { policyGateSchema } from "@/lib/policy-gates/schemas";
import type { PolicyGateRepository } from "@/lib/policy-gates/policy-gate-repository";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";

export const workflowInputSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  leadScore: z.number().int().min(0).max(100),
  requestedBy: z.string().min(1),
  correlationId: z.string().min(1),
  workflowRunId: z.string().min(1),
});
const resultSchema = z.object({
  client: clientSchema,
  branch: z.enum(["onboard", "nurture", "prospect"]),
  steps: z.array(
    z.object({
      stage: pipelineStageSchema,
      agentRole: z.enum(["prospector", "nurture", "onboarding"]),
      note: z.string(),
      emailGateId: z.string().optional(),
    }),
  ),
  pendingEmailGates: z.array(policyGateSchema),
});
const contextSchema = z.object({
  input: workflowInputSchema,
  result: resultSchema,
});
export type PipelineWorkflowDeps = {
  pipeline: ClientPipelineService;
  gates: PolicyGateRepository;
  logs: AgentActionLogRepository;
};

export const createClientPipelineWorkflow = (
  load: () => Promise<PipelineWorkflowDeps>,
) => {
  const route = createStep({
    id: "route-lead",
    inputSchema: workflowInputSchema,
    outputSchema: contextSchema,
    execute: async ({ inputData, runId, mastra }) => {
      if (!(mastra?.getStorage() instanceof MongoDBStore))
        throw new Error("Durable Mongo workflow storage is required");
      if (runId !== inputData.workflowRunId)
        throw new Error("Workflow run ID mismatch");
      const deps = await load();
      // BSON encodes explicit undefined properties as null. Omit absent
      // optional fields before snapshotting so Zod can validate a resumed step.
      const result = resultSchema.parse(
        JSON.parse(JSON.stringify(await deps.pipeline.run(inputData))),
      );
      await deps.logs.append({
        tenantId: inputData.tenantId,
        agentName: "client-pipeline-workflow",
        toolName: "clientPipeline.route",
        input: inputData,
        output: {
          runId,
          branch: result.branch,
          gateIds: result.pendingEmailGates.map((g) => g.id),
          agentInvocations: 0,
        },
        status: "success",
        correlationId: inputData.correlationId,
      });
      return { input: inputData, result };
    },
  });
  const boundary = createStep({
    id: "human-approval",
    inputSchema: contextSchema,
    outputSchema: contextSchema,
    resumeSchema: z.object({}).strict(),
    suspendSchema: z.object({
      gateIds: z.array(z.string()),
      runId: z.string(),
    }),
    execute: async ({ inputData, suspend }) => {
      const deps = await load();
      const gates = await Promise.all(
        inputData.result.pendingEmailGates.map((g) =>
          deps.gates.getByTenantAndId(inputData.input.tenantId, g.id),
        ),
      );
      if (gates.some((g) => !g))
        throw new Error("Workflow gate not found for tenant");
      if (gates.some((g) => g?.status === "pending"))
        return suspend({
          gateIds: gates.map((g) => g!.id),
          runId: inputData.input.workflowRunId,
        });
      // Resuming does not approve anything. Only the authorized decision service can do so.
      return {
        ...inputData,
        result: {
          ...inputData.result,
          pendingEmailGates: gates.map((g) => g!),
        },
      };
    },
  });
  return createWorkflow({
    id: "client-pipeline",
    inputSchema: workflowInputSchema,
    outputSchema: contextSchema,
  })
    .then(route)
    .then(boundary)
    .commit();
};
export type ClientPipelineWorkflow = ReturnType<
  typeof createClientPipelineWorkflow
>;
