import type { ClientPipelineService } from "@/lib/client-pipeline/client-pipeline-service";

/**
 * Thin workflow seam for Mastra registration. Branching and gates live in
 * `createClientPipelineService` so tests stay dependency-light.
 */
export const createClientPipelineWorkflow = (deps: {
  pipeline: ClientPipelineService;
}) => ({
  id: "client-pipeline",
  description:
    "Lead → prospect → qualify → nurture/onboard with score branching and gated email",
  run: deps.pipeline.run,
});

export type ClientPipelineWorkflow = ReturnType<
  typeof createClientPipelineWorkflow
>;
