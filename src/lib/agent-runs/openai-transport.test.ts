import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAIBoundedGenerator } from "./openai-bounded-generator";
import { FIXTURE } from "./schemas";

// Real pinned Mastra/OpenAI serialization and parsing, entirely intercepted HTTP.
// This is not a test of account entitlement or live model quality.
const env = {
  NODE_ENV: "development", AGENCYOS_AGENT_RUN_ENABLED: "true",
  AGENCYOS_AGENT_RUN_TENANT_ID: "synthetic", AGENCYOS_AGENT_RUN_PROJECT_ID: "a".repeat(24),
  AGENCYOS_AGENT_RUN_MODEL: "gpt-6-astra", OPENAI_API_KEY: "synthetic-test-key",
} as NodeJS.ProcessEnv;
const task = { title: "Plan Example Studio", description: "Create a fictional accessible website brief." };
const brief = { title: "Example Studio brief", body: "A fictional accessible website plan." };
type CapturedRequest = { url: string; body: Record<string, unknown>; authorization: string | null };
let requests: CapturedRequest[];

const response = (stage: "task" | "brief", incomplete = false) => {
  const item = stage === "task"
    ? { type: "function_call", id: "fc_test", call_id: "call_test", name: "createTask", arguments: JSON.stringify(task) }
    : { type: "message", id: "msg_test", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(brief), annotations: [] }] };
  return new Response(JSON.stringify({
    id: "resp_test", created_at: 1, model: "gpt-6-astra",
    status: incomplete ? "incomplete" : "completed", output: [item],
    incomplete_details: incomplete ? { reason: "max_output_tokens" } : null,
    usage: { input_tokens: 100, output_tokens: 50 },
  }), { headers: { "Content-Type": "application/json" } });
};

const intercept = (reply: () => Response) => vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const target = String(url);
  if (target !== "https://api.openai.com/v1/responses") throw new Error("Unexpected network destination in offline test");
  requests.push({ url: target, body: JSON.parse(String(init?.body)), authorization: new Headers(init?.headers).get("authorization") });
  return reply();
}));

beforeEach(() => {
  requests = [];
  vi.stubEnv("OPENAI_BASE_URL", undefined);
  vi.stubEnv("MASTRA_OFFLINE", "true");
  vi.stubEnv("MASTRA_AUTO_REFRESH_PROVIDERS", "false");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("OpenAI Responses transport (offline)", () => {
  it("uses the exact model, forced Task tool, strict brief schema and bounded standard requests", async () => {
    intercept(() => response(requests.length === 1 ? "task" : "brief"));
    const generator = await createOpenAIBoundedGenerator(env);
    const commit = vi.fn().mockResolvedValue({ taskId: "task-synthetic" });
    const signal = new AbortController().signal;
    await generator.orchestrate(FIXTURE.prompt, commit, signal);
    expect(commit).toHaveBeenCalledExactlyOnceWith(task);
    expect(await generator.produceBrief(task, signal)).toEqual(brief);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.authorization).toBe("Bearer synthetic-test-key");
      expect(request.body).toMatchObject({ model: "gpt-6-astra", store: false, service_tier: "default", reasoning: { effort: "low" } });
      expect(JSON.stringify(request.body)).not.toContain("synthetic-test-key");
    }
    expect(requests[0]!.body).toMatchObject({ max_output_tokens: 1500, tool_choice: { type: "function", name: "createTask" } });
    expect(requests[0]!.body.tools).toEqual([expect.objectContaining({ type: "function", name: "createTask" })]);
    expect(requests[1]!.body).toMatchObject({ max_output_tokens: 3000, text: { format: {
      type: "json_schema", strict: true, schema: { type: "object", required: ["title", "body"], additionalProperties: false },
    } } });
    expect(requests[1]!.body.tools ?? []).toEqual([]);
  });
  it.each([401, 404, 429, 500])("does not retry or change models after HTTP %s", async status => {
    intercept(() => new Response(JSON.stringify({ error: { message: "Synthetic provider failure", type: "test_error" } }), {
      status, headers: { "Content-Type": "application/json" },
    }));
    const generator = await createOpenAIBoundedGenerator(env);
    const commit = vi.fn();
    await expect(generator.orchestrate(FIXTURE.prompt, commit, new AbortController().signal)).rejects.toThrow();
    expect(commit).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);
  });
  it("rejects a token-limited response even when its JSON is valid", async () => {
    intercept(() => response("brief", true));
    const generator = await createOpenAIBoundedGenerator(env);
    await expect(generator.produceBrief(task, new AbortController().signal)).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });
});
