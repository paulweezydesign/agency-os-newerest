import { z } from "zod";
import { workflowRunSchema, gateIsTerminal } from "./workflow-contract";
export const workflowViewSchema = workflowRunSchema.transform((run) => ({
  ...run, state: run.engineState ?? "uncertain" as const,
}));
export type WorkflowView = z.output<typeof workflowViewSchema>;
export const gatesAreTerminal = (view: WorkflowView) => view.gates.every(gateIsTerminal);
export const canResumeWorkflow = (view: WorkflowView | null) => Boolean(view && view.state === "suspended" && gatesAreTerminal(view));
