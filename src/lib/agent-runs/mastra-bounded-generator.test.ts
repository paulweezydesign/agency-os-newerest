import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), configs: [] as Record<string, unknown>[] }));
vi.mock("@mastra/core/agent", () => ({ Agent: class {
  generate = mocks.generate;
  constructor(config: Record<string, unknown>) { mocks.configs.push(config); }
} }));
import { createMastraBoundedGenerator } from "./mastra-bounded-generator";
describe("bounded Mastra capabilities", () => {
  it("has exactly one Project Manager tool and a tool-free teammate with explicit limits", async () => {
    mocks.configs.length = 0;
    mocks.generate.mockReset().mockResolvedValue({ object: { title: "Brief", body: "Fictional" } });
    const generator = createMastraBoundedGenerator("approved/model", "approved/model");
    const signal = new AbortController().signal;
    await generator.orchestrate("fixture", vi.fn(), signal);
    await generator.produceBrief({ title: "Task", description: "Fictional" }, signal);
    expect(Object.keys(mocks.configs[0]!.tools as object)).toEqual(["createTask"]);
    expect(mocks.configs[1]!.tools).toEqual({});
    expect(mocks.configs.every(c => c.model === "approved/model" && c.maxRetries === 0)).toBe(true);
    expect(mocks.generate).toHaveBeenNthCalledWith(1, "fixture", expect.objectContaining({ maxSteps: 1, maxProcessorRetries: 0, abortSignal: signal, modelSettings: { maxOutputTokens: 1500 }, toolChoice: { type: "tool", toolName: "createTask" } }));
    expect(mocks.generate).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({ maxSteps: 1, maxProcessorRetries: 0, abortSignal: signal, modelSettings: { maxOutputTokens: 3000 }, toolChoice: "none" }));
  });
});
