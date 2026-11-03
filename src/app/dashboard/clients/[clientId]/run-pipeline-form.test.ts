import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RunPipelineForm } from "./run-pipeline-form";
import { WorkflowRunStatus } from "./durable-pipeline-form";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
it("selects the durable form on server opt-in and exposes no legacy email override", () => {
  const html = renderToStaticMarkup(
    createElement(RunPipelineForm, {
      clientId: "client-a",
      tenantId: "tenant-a",
      durableWorkflowEnabled: true,
      syntheticContact: true,
      defaultEmail: "lead@example.test",
    }),
  );
  expect(html).toContain("Durable dry-run client pipeline");
  expect(html).toContain("Run dry-run pipeline");
  expect(html).not.toContain("Contact email (gated before Resend)");
  expect(html).not.toContain("lead@example.test");
  expect(html).toContain("Restoring saved run");
});
it("retains the explicit legacy form when server opt-in is off", () => {
  const html = renderToStaticMarkup(
    createElement(RunPipelineForm, {
      clientId: "client-a",
      tenantId: "tenant-a",
      durableWorkflowEnabled: false,
      syntheticContact: false,
    }),
  );
  expect(html).toContain("Run client pipeline");
  expect(html).not.toContain("Durable dry-run client pipeline");
});
it("explains the .test contact requirement", () => {
  const html = renderToStaticMarkup(
    createElement(RunPipelineForm, {
      clientId: "client-a",
      tenantId: "tenant-a",
      durableWorkflowEnabled: true,
      syntheticContact: false,
    }),
  );
  expect(html).toContain("A saved contact ending in .test is required");
});
it.each(["pending", "approved", "denied"] as const)(
  "renders truthful %s gate state and exact review link",
  (status) => {
    const id = "0123456789abcdef01234567";
    const html = renderToStaticMarkup(
      createElement(WorkflowRunStatus, {
        view: {
          runId: "run-a",
          correlationId: "correlation-a",
          state: "suspended",
          gates: [{ id, status }],
        },
      }),
    );
    expect(html).toContain(status);
    expect(html).toContain(`/dashboard/policy-gates?gateId=${id}#gate-${id}`);
    expect(html).toContain("run-a");
    expect(html).toContain("correlation-a");
  },
);
it("shows uncertain outcomes as blocked rather than successful delivery", () => {
  const html = renderToStaticMarkup(
    createElement(WorkflowRunStatus, {
      view: {
        runId: "run-a",
        correlationId: "correlation-a",
        state: "uncertain",
        gates: [
          {
            id: "0123456789abcdef01234567",
            status: "pending",
            executionState: "uncertain",
          },
        ],
      },
    }),
  );
  expect(html).toContain("Outcome uncertain");
  expect(html).toContain("blocked for review");
  expect(html).not.toContain("Workflow completed");
});
