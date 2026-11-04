import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
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
    execute: async ({ inputData }) => {
      const { prepareClientPipelineWorkflow } = await import("@/lib/client-pipeline/workflow-service");
      return prepareClientPipelineWorkflow(inputData);
    },
  });
  const route = createStep({
    id: "score-route-and-request-approval",
    inputSchema: workflowPreparedSchema,
    outputSchema: workflowRoutedSchema,
    execute: async ({ inputData }) => {
      const { routeClientPipelineWorkflow } = await import("@/lib/client-pipeline/workflow-service");
      return routeClientPipelineWorkflow(inputData);
    },
  });
  const checkpoint = createStep({
    id: "persist-approval-boundary",
    inputSchema: workflowRoutedSchema,
    outputSchema: workflowRunSchema,
    execute: async ({ inputData }) => {
      const { completeClientPipelineWorkflow } = await import("@/lib/client-pipeline/workflow-service");
      return completeClientPipelineWorkflow(inputData);
    },
  });

  return createWorkflow({
    id: "client-pipeline",
    description: "Synthetic lead scoring and routing; stops at a durable human approval boundary",
    inputSchema: workflowInputSchema,
    outputSchema: workflowRunSchema,
  }).then(prepare).then(route).then(checkpoint).commit();
};

export type ClientPipelineWorkflow = ReturnType<typeof createClientPipelineWorkflow>;
