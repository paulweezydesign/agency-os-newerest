import { describe, expect, it, vi } from "vitest";
import { handleRunWorkflow, handleReadWorkflow, isWorkflowEnabled } from "./workflow-api";

const session = { user: { id: "operator", tenantId: "tenant-a", role: "agent-operator" } };
const body = { runId: "d6618944-f3bc-42ef-9d44-68f925475be7", leadScore: 70 };
const setup = () => ({ execute: vi.fn().mockResolvedValue({ status: "awaiting_approval" }), read: vi.fn().mockResolvedValue(null) });

describe("protected synthetic workflow API", () => {
  it("requires an explicit opt-in and rejects production", () => {
    expect(isWorkflowEnabled({ AGENCYOS_DRY_RUN_WORKFLOW: "true", VERCEL_ENV: "production" })).toBe(false);
    expect(isWorkflowEnabled({ AGENCYOS_DRY_RUN_WORKFLOW: "true", VERCEL_ENV: "preview" })).toBe(true);
    expect(isWorkflowEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isWorkflowEnabled({ AGENCYOS_DRY_RUN_WORKFLOW: "true", NODE_ENV: "production" })).toBe(false);
  });
  it.each([null, { user: { ...session.user, role: "client" } }, { user: { ...session.user, tenantId: "" } }])("rejects unauthorized identities before touching storage", async (identity) => {
    const deps = setup();
    const result = await handleRunWorkflow({ session: identity, enabled: true, clientId: "client", body, ...deps });
    expect([401, 403]).toContain(result.status);
    expect(deps.execute).not.toHaveBeenCalled();
  });
  it("uses session tenant/operator and a stable server-derived correlation ID", async () => {
    const deps = setup();
    const result = await handleRunWorkflow({ session, enabled: true, clientId: "client", body: { ...body, tenantId: "victim", operatorId: "admin", correlationId: "forged" }, ...deps });
    expect(result.status).toBe(200);
    expect(deps.execute).toHaveBeenCalledWith({ ...body, clientId: "client", tenantId: "tenant-a", operatorId: "operator", correlationId: `client-pipeline:${body.runId}` });
  });
  it.each([-1, 101, 1.5, null, "", true])("rejects invalid score %s", async (leadScore) => {
    const deps = setup();
    const result = await handleRunWorkflow({ session, enabled: true, clientId: "client", body: { ...body, leadScore }, ...deps });
    expect(result.status).toBe(400);
    expect(deps.execute).not.toHaveBeenCalled();
  });
  it("rejects disabled execution", async () => {
    const deps = setup();
    expect((await handleRunWorkflow({ session, enabled: false, clientId: "client", body, ...deps })).status).toBe(404);
    expect(deps.execute).not.toHaveBeenCalled();
  });
  it("scopes reads to both tenant and client", async () => {
    const deps = setup();
    deps.read.mockResolvedValue({ clientId: "different-client", secret: "hidden" });
    const result = await handleReadWorkflow({ session, enabled: true, clientId: "client", runId: body.runId, ...deps });
    expect(deps.read).toHaveBeenCalledWith("tenant-a", body.runId);
    expect(result).toEqual({ status: 404, body: { error: "Workflow run not found" } });
  });
});
