import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), configs: [] as Record<string, unknown>[] }));
vi.mock("@mastra/core/agent", () => ({ Agent: class {
  generate = mocks.generate;
  __setLogger() {}
  constructor(config: Record<string, unknown>) { mocks.configs.push(config); }
} }));
import { createMastraBoundedGenerator } from "./mastra-bounded-generator";
describe("bounded Mastra capabilities", () => {
  it("has exactly one Project Manager tool and a tool-free teammate with explicit limits", async () => {
    mocks.configs.length = 0;
    mocks.generate.mockReset().mockResolvedValue({ finishReason: "stop", object: { title: "Brief", body: "Fictional" } });
    const generator = createMastraBoundedGenerator("approved/model", "approved/model");
    const signal = new AbortController().signal;
    await generator.orchestrate("fixture", vi.fn(), signal);
    await generator.produceBrief({ title: "Task", description: "Fictional" }, signal);
    expect(Object.keys(mocks.configs[0]!.tools as object)).toEqual(["createTask"]);
    expect(mocks.configs[1]!.tools).toEqual({});
    expect(mocks.configs.every(c => c.model === "approved/model" && c.maxRetries === 0)).toBe(true);
    expect(mocks.generate).toHaveBeenNthCalledWith(1, "fixture", expect.objectContaining({ maxSteps: 1, maxProcessorRetries: 0, abortSignal: signal, modelSettings: { maxOutputTokens: 1500, maxRetries: 0 }, toolChoice: { type: "tool", toolName: "createTask" } }));
    expect(mocks.generate).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({ maxSteps: 1, maxProcessorRetries: 0, abortSignal: signal, modelSettings: { maxOutputTokens: 3000, maxRetries: 0 }, toolChoice: "none" }));
  });
  it.each(["length", "content-filter", "error", "unknown", undefined])("rejects non-complete output %s", async finishReason => {
    mocks.generate.mockReset().mockResolvedValue({ finishReason, object: { title: "Brief", body: "Fictional" } });
    const generator = createMastraBoundedGenerator("approved/model", "approved/model");
    const signal = new AbortController().signal;
    await expect(generator.orchestrate("fixture", vi.fn(), signal)).rejects.toThrow("did not complete");
    await expect(generator.produceBrief({ title: "Task", description: "Fictional" }, signal)).rejects.toThrow("did not complete");
  });
  it("does not initialize or invoke a model after cancellation", async () => {
    mocks.generate.mockClear(); mocks.configs.length = 0;
    const controller = new AbortController(); controller.abort();
    const generator = createMastraBoundedGenerator("approved/model", "approved/model");
    await expect(generator.orchestrate("fixture", vi.fn(), controller.signal)).rejects.toThrow();
    await expect(generator.produceBrief({ title: "Task", description: "Fictional" }, controller.signal)).rejects.toThrow();
    expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.configs).toHaveLength(0);
  });
});
