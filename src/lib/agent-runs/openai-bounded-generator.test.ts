import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAIBoundedGenerator, OPENAI_AGENT_MODEL } from "./openai-bounded-generator";

const mocks = vi.hoisted(() => ({ create: vi.fn(() => ({ modelId: "openai/gpt-6-astra" })) }));
vi.mock("./mastra-bounded-generator", () => ({ createMastraBoundedGenerator: mocks.create }));
const env = {
  NODE_ENV: "development", AGENCYOS_AGENT_RUN_ENABLED: "true",
  AGENCYOS_AGENT_RUN_TENANT_ID: "synthetic", AGENCYOS_AGENT_RUN_PROJECT_ID: "a".repeat(24),
  AGENCYOS_AGENT_RUN_MODEL: "openai/gpt-6-astra", OPENAI_API_KEY: "synthetic-test-key",
} as NodeJS.ProcessEnv;

beforeEach(() => { vi.stubEnv("OPENAI_BASE_URL", undefined); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("OpenAI bounded provider configuration", () => {
  it.each([
    { ...env, AGENCYOS_AGENT_RUN_ENABLED: "false" },
    { ...env, NODE_ENV: "production" },
    { ...env, VERCEL_ENV: "production" },
    { ...env, OPENAI_API_KEY: undefined },
    { ...env, OPENAI_API_KEY: "  " },
    { ...env, AGENCYOS_AGENT_RUN_MODEL: "openai/gpt-6-luna" },
    { ...env, AGENCYOS_AGENT_RUN_MODEL: "other/gpt-6-astra" },
    { ...env, OPENAI_BASE_URL: "https://example.test/v1" },
  ])("rejects unapproved configuration before constructing a provider", async invalid => {
    await expect(createOpenAIBoundedGenerator(invalid as NodeJS.ProcessEnv)).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["gpt-6-astra", "openai/gpt-6-astra"])("selects only the requested model for %s without a request", async modelId => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const generator = await createOpenAIBoundedGenerator({ ...env, AGENCYOS_AGENT_RUN_MODEL: modelId });
    expect(generator.modelId).toBe(OPENAI_AGENT_MODEL);
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(OPENAI_AGENT_MODEL,
      { id: OPENAI_AGENT_MODEL, apiKey: "synthetic-test-key" },
      { openai: { transport: "fetch", reasoningEffort: "low", store: false, serviceTier: "default" } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never includes a key or custom endpoint in configuration errors", async () => {
    await expect(createOpenAIBoundedGenerator({ ...env, OPENAI_BASE_URL: "https://example.test/private" }))
      .rejects.toThrow("Custom OpenAI endpoints are not supported");
  });
  it("rejects a process endpoint override even when a separate configuration is supplied", async () => {
    vi.stubEnv("OPENAI_BASE_URL", "https://example.test/v1");
    await expect(createOpenAIBoundedGenerator(env)).rejects.toThrow("Custom OpenAI endpoints are not supported");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
