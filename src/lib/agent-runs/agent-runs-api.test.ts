import { describe, expect, it, vi } from "vitest";
import { handleAgentRunRequest } from "./agent-runs-api";
import { resolveAgentRunConfig } from "./runtime-policy";
import { FIXTURE } from "./schemas";
const projectId = "a".repeat(24);
const env = { NODE_ENV: "development", AGENCYOS_AGENT_RUN_ENABLED: "true", AGENCYOS_AGENT_RUN_TENANT_ID: "synthetic", AGENCYOS_AGENT_RUN_PROJECT_ID: projectId, AGENCYOS_AGENT_RUN_MODEL: "approved-test-model" } as NodeJS.ProcessEnv;
const session = { user: { id: "operator", role: "agent-operator", tenantId: "synthetic" } };
const body = { runId: "6a877e9b-5934-4ec0-a0db-90ae5d2c139d", fixtureId: FIXTURE.id };
describe("agent run admission boundary", () => {
  it.each([null, { user: { ...session.user, role: "client" } }])("authorizes before dependencies", async deniedSession => {
    const start = vi.fn();
    const result = await handleAgentRunRequest({ session: deniedSession, projectId, method: "POST", body, deps: { env, start } });
    expect([401, 403]).toContain(result.status);
    expect(start).not.toHaveBeenCalled();
  });
  it.each([
    {}, { ...env, AGENCYOS_AGENT_RUN_ENABLED: "false" },
    { ...env, NODE_ENV: "production" },
    { ...env, VERCEL_ENV: "production", AGENCYOS_AGENT_RUN_PROTECTED_PREVIEW: "true" },
    { ...env, VERCEL_ENV: "preview" },
    { ...env, AGENCYOS_AGENT_RUN_MODEL: "" },
    { ...env, AGENCYOS_AGENT_RUN_TENANT_ID: "" },
    { ...env, AGENCYOS_AGENT_RUN_PROJECT_ID: "invalid" },
  ])("fails closed for config %j", badEnv => {
    expect(() => resolveAgentRunConfig(badEnv as NodeJS.ProcessEnv)).toThrow();
  });
  it("allows only explicit protected Preview or local scope", () => {
    expect(resolveAgentRunConfig(env).modelId).toBe("approved-test-model");
    expect(resolveAgentRunConfig({ ...env, NODE_ENV: "production", VERCEL_ENV: "preview", AGENCYOS_AGENT_RUN_PROTECTED_PREVIEW: "true" }).projectId).toBe(projectId);
  });
  it("rejects other tenant and Project without storage", async () => {
    const start = vi.fn();
    for (const change of [{ projectId: "b".repeat(24) }, { session: { user: { ...session.user, tenantId: "other" } } }]) {
      expect((await handleAgentRunRequest({ session, projectId, ...change, method: "POST", body, deps: { env, start } })).status).toBe(403);
    }
    expect(start).not.toHaveBeenCalled();
  });
  it.each([{ ...body, tenantId: "other" }, { ...body, message: "send mail" }, { ...body, model: "other" }, { ...body, fixtureId: "real-data" }])("rejects model-controlled scope %j", invalid => {
    const start = vi.fn();
    return handleAgentRunRequest({ session, projectId, method: "POST", body: invalid, deps: { env, start } }).then(result => {
      expect(result.status).toBe(400); expect(start).not.toHaveBeenCalled();
    });
  });
  it("has no implicit live adapter even with explicit runtime configuration", async () => {
    const result = await handleAgentRunRequest({ session, projectId, method: "POST", body, deps: { env } });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: "Live model adapter requires explicit provider approval and configuration" });
  });
  it("derives tenant and actor from the authenticated session", async () => {
    const start = vi.fn().mockResolvedValue({ state: "completed" });
    const result = await handleAgentRunRequest({ session, projectId, method: "POST", body, deps: { env, start } });
    expect(result.status).toBe(200);
    expect(start).toHaveBeenCalledExactlyOnceWith({ ...body, projectId, tenantId: "synthetic", actorId: "operator" });
  });
  it("inspects persisted state without a model adapter", async () => {
    const inspect = vi.fn().mockResolvedValue({ state: "uncertain" });
    expect((await handleAgentRunRequest({ session, projectId, method: "GET", body: { runId: body.runId }, deps: { env, inspect } })).status).toBe(200);
    expect(inspect).toHaveBeenCalledExactlyOnceWith({ runId: body.runId, projectId, tenantId: "synthetic" });
  });
});
