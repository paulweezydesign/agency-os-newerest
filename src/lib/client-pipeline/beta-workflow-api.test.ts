import { it, expect, vi } from "vitest";
import { handleBetaWorkflow } from "./beta-workflow-api";
import type { AuthSession } from "@/lib/auth/session-context";
it.each([null, { user: { id: "client", role: "client", tenantId: "test" } }])(
  "rejects unauthorized access before loading storage",
  async (session) => {
    const loadRuntime = vi.fn();
    const result = await handleBetaWorkflow({
      session: session as AuthSession,
      clientId: "test",
      body: {},
      loadRuntime,
    });
    expect([401, 403]).toContain(result.status);
    expect(loadRuntime).not.toHaveBeenCalled();
  },
);
it("rejects forged tenant, actor and approval fields", async () => {
  const loadRuntime = vi.fn();
  const result = await handleBetaWorkflow({
    session: { user: { id: "operator", role: "admin", tenantId: "test" } },
    clientId: "test",
    body: {
      operation: "start",
      requestId: crypto.randomUUID(),
      leadScore: 70,
      tenantId: "other",
      approved: true,
    },
    loadRuntime,
  });
  expect(result.status).toBe(400);
  expect(loadRuntime).not.toHaveBeenCalled();
});

it("binds tenant, actor and run identity to authenticated context across retries", async () => {
  const runtime = {
    start: vi.fn(async () => ({
      runId: "test",
      correlationId: "test",
      state: "success" as const,
      snapshot: null,
      gates: [],
    })),
    inspect: vi.fn(),
    resume: vi.fn(),
    close: vi.fn(async () => undefined),
  };
  const input = {
    session: {
      user: { id: "operator", role: "admin" as const, tenantId: "test" },
    },
    clientId: "client-test",
    body: {
      operation: "start",
      requestId: "99530f56-aab4-4dfe-9704-75fe0317eeda",
      leadScore: 70,
    },
    loadRuntime: async () => runtime,
  };
  await handleBetaWorkflow(input);
  await handleBetaWorkflow(input);
  expect(runtime.start.mock.calls[0]).toEqual(runtime.start.mock.calls[1]);
  expect(runtime.start).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: "test", requestedBy: "operator" }),
  );
  expect(runtime.close).toHaveBeenCalledTimes(2);
});
