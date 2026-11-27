import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { WorkflowRunStatus } from "./durable-pipeline-form";
import { workflowViewSchema, canResumeWorkflow } from "@/lib/client-pipeline/workflow-view";
const view = (effectStatus: string, receipt = false) => workflowViewSchema.parse({
  tenantId: "test", clientId: "test", runId: "test", correlationId: "correlation", mastraRunId: "engine", checkpoints: [], engineState: "suspended", status: "awaiting_approval",
  gates: [{ id: "0123456789abcdef01234567", tenantId: "test", status: "approved", actionType: "client_email", payload: {}, requestedBy: "test", correlationId: "test", createdAt: "test", effectRan: receipt, effectStatus, dryRun: true,
    ...(receipt ? { effectReceipt: { key: "policy-gate:0123456789abcdef01234567", mode: "dry-run", recordedAt: "test" } } : {}) }],
});
describe("receipt-aware operator status", () => {
  it.each(["running", "failed", "unknown"])("renders blocked approved/%s truthfully", (status) => {
    const state = view(status);
    expect(canResumeWorkflow(state)).toBe(false);
    const html = renderToStaticMarkup(createElement(WorkflowRunStatus, { view: state }));
    expect(html).toContain("resume blocked");
    expect(html).toContain("Mastra run ID");
    expect(html).toContain("gateId=0123456789abcdef01234567");
  });
  it("allows only receipt-confirmed approval or denial", () => {
    expect(canResumeWorkflow(view("succeeded", true))).toBe(true);
    expect(canResumeWorkflow(view("succeeded"))).toBe(false);
    const state = view("idle"); state.gates[0].status = "denied";
    expect(canResumeWorkflow(state)).toBe(true);
  });
});
