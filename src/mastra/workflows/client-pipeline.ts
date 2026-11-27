import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
  gateIsTerminal,
  workflowInputSchema,
  workflowPreparedSchema,
  workflowRoutedSchema,
  workflowRunSchema,
} from "@/lib/client-pipeline/workflow-contract";

// Dependencies load only during execution. Registration does not connect MongoDB
// or instantiate providers, and therefore needs no build-time credentials.
export const createClientPipelineWorkflow = () => {
  const prepare = createStep({
    id: "persist-input",
    inputSchema: workflowInputSchema,
    outputSchema: workflowPreparedSchema,
    execute: async ({ inputData, mastra }) => {
      const { MongoDBStore } = await import("@mastra/mongodb");
      if (!(mastra?.getStorage() instanceof MongoDBStore)) throw new Error("Client pipeline requires Mongo-backed Mastra storage");
      const { prepareClientPipelineWorkflow } = await import("@/lib/client-pipeline/workflow-service");
      return JSON.parse(JSON.stringify(await prepareClientPipelineWorkflow(inputData)));
    },
  });
  const route = createStep({
    id: "score-route-and-request-approval",
    inputSchema: workflowPreparedSchema,
    outputSchema: workflowRoutedSchema,
    execute: async ({ inputData }) => {
      const { routeClientPipelineWorkflow } = await import("@/lib/client-pipeline/workflow-service");
      return JSON.parse(JSON.stringify(await routeClientPipelineWorkflow(inputData)));
    },
  });
  const checkpoint = createStep({
    id: "persist-approval-boundary",
    inputSchema: workflowRoutedSchema,
    outputSchema: workflowRunSchema,
    execute: async ({ inputData }) => {
      const { completeClientPipelineWorkflow } = await import("@/lib/client-pipeline/workflow-service");
      return JSON.parse(JSON.stringify(await completeClientPipelineWorkflow(inputData)));
    },
  });

  const approval = createStep({
    id: "human-approval",
    inputSchema: workflowRunSchema,
    outputSchema: workflowRunSchema,
    resumeSchema: z.object({}).strict(),
    suspendSchema: z.object({ runId: z.string() }),
    execute: async ({ inputData, suspend }) => {
      const { getClientPipelineWorkflowRun } = await import("@/lib/client-pipeline/workflow-service");
      const current = await getClientPipelineWorkflowRun(inputData.tenantId, inputData.runId);
      if (!current || !current.result) throw new Error("Workflow approval checkpoint missing");
      if (!current.gates.every(gateIsTerminal)) return suspend({ runId: current.runId });
      return JSON.parse(JSON.stringify(current));
    },
  });

  return createWorkflow({
    id: "client-pipeline",
    description: "Synthetic lead scoring and routing; stops at a durable human approval boundary",
    inputSchema: workflowInputSchema,
    outputSchema: workflowRunSchema,
  }).then(prepare).then(route).then(checkpoint).then(approval).commit();
};

export type ClientPipelineWorkflow = ReturnType<typeof createClientPipelineWorkflow>;
