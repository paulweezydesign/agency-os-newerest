import { z } from "zod";

export const workflowViewSchema = z.object({
  runId: z.string().min(1),
  correlationId: z.string().min(1),
  state: z.enum(["running", "suspended", "success", "uncertain"]),
  gates: z.array(
    z.object({
      id: z.string().regex(/^[a-f\d]{24}$/i),
      status: z.enum(["pending", "approved", "denied"]),
      executionState: z.enum(["claimed", "uncertain", "completed"]).optional(),
    }),
  ),
});
export type WorkflowView = z.infer<typeof workflowViewSchema>;
export const gatesAreTerminal = (view: WorkflowView) =>
  view.gates.every(
    (g) =>
      g.status !== "pending" &&
      g.executionState !== "claimed" &&
      g.executionState !== "uncertain",
  );
export const canResumeWorkflow = (view: WorkflowView | null) =>
  Boolean(
    view &&
      view.state === "suspended" &&
      view.gates.length &&
      gatesAreTerminal(view),
  );
export const canStartNewWorkflow = (view: WorkflowView | null) =>
  Boolean(view && view.state === "success" && gatesAreTerminal(view));
