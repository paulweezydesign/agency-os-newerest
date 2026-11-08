import { describe, expect, it, vi } from "vitest";
import { createAgentRunService, type BoundedGenerator } from "./agent-run-service";
import type { AgentRunRepository } from "./agent-run-repository";
import { AgentRunConflict, FIXTURE, type AgentRun } from "./schemas";
const input = { tenantId: "synthetic", projectId: "a".repeat(24), runId: "6a877e9b-5934-4ec0-a0db-90ae5d2c139d", actorId: "operator", fixtureId: FIXTURE.id };
const task = { title: "Plan fictional website", description: "Write an internal brief" };
const brief = { title: "Internal brief", body: "An accessible fictional site." };

const harness = () => {
  let run: AgentRun | null = null;
  const repository: AgentRunRepository = {
    inspect: vi.fn(async () => run && { ...run }),
    admit: vi.fn(async (requested: AgentRun) => {
      if (run) {
        if (run.runId !== requested.runId || run.modelId !== requested.modelId) throw new AgentRunConflict();
        return { run: { ...run }, admitted: false };
      }
      run = { ...requested };
      return { run: { ...run }, admitted: true };
    }),
    createTask: vi.fn(async () => {
      run = { ...run!, taskId: "task", state: "task_created" };
      return { ...run };
    }),
    complete: vi.fn(async () => {
      run = { ...run!, artifactId: "artifact", state: "completed" };
      return { ...run };
    }),
    markUncertain: vi.fn(async () => {
      if (run && run.state !== "completed") run = { ...run, state: "uncertain" };
    }),
  };
  const generator: BoundedGenerator = {
    modelId: "approved-test-model",
    orchestrate: vi.fn(async (_prompt, createTask) => { await createTask(task); }),
    produceBrief: vi.fn(async () => brief),
  };
  return { repository, generator, service: createAgentRunService(repository, generator) };
};
describe("bounded agent run", () => {
  it("commits a Task through the Project Manager tool before one teammate artifact", async () => {
    const h = harness();
    expect(await h.service.start(input)).toMatchObject({ state: "completed", taskId: "task", artifactId: "artifact" });
    expect(h.generator.orchestrate).toHaveBeenCalledWith(FIXTURE.prompt, expect.any(Function), expect.any(AbortSignal));
    expect(h.generator.produceBrief).toHaveBeenCalledWith(task, expect.any(AbortSignal));
    expect(h.repository.createTask).toHaveBeenCalledExactlyOnceWith(input, task);
    expect(h.repository.complete).toHaveBeenCalledExactlyOnceWith(input, brief);
  });
  it("does not replay completed or parallel admissions", async () => {
    const h = harness();
    await Promise.all([h.service.start(input), h.service.start(input)]);
    await h.service.start(input);
    expect(h.generator.orchestrate).toHaveBeenCalledTimes(1);
    expect(h.generator.produceBrief).toHaveBeenCalledTimes(1);
  });
  it("deduplicates repeated parallel identical Task tool calls", async () => {
    const h = harness();
    h.generator.orchestrate = async (_p, createTask) => { await Promise.all([createTask(task), createTask(task)]); };
    expect((await h.service.start(input)).state).toBe("completed");
    expect(h.repository.createTask).toHaveBeenCalledTimes(1);
  });
  it("does not treat model prose without a Task tool call as success", async () => {
    const h = harness();
    h.generator.orchestrate = async () => undefined;
    expect((await h.service.start(input)).state).toBe("uncertain");
    expect(h.generator.produceBrief).not.toHaveBeenCalled();
  });
  it("blocks malformed or differently scoped Task input", async () => {
    const h = harness();
    h.generator.orchestrate = async (_p, createTask) => { await createTask({ ...task, projectId: "other" }); };
    expect((await h.service.start(input)).state).toBe("uncertain");
    expect(h.repository.createTask).not.toHaveBeenCalled();
  });
  it("rejects second different Task and never invokes teammate", async () => {
    const h = harness();
    h.generator.orchestrate = async (_p, createTask) => { await createTask(task); await createTask({ ...task, title: "Another" }); };
    expect((await h.service.start(input)).state).toBe("uncertain");
    expect(h.repository.createTask).toHaveBeenCalledTimes(1);
    expect(h.generator.produceBrief).not.toHaveBeenCalled();
  });
  it("blocks even when the model swallows a rejected extra Task tool call", async () => {
    const h = harness();
    h.generator.orchestrate = async (_p, createTask) => {
      await createTask(task);
      await createTask({ ...task, title: "Another" }).catch(() => undefined);
    };
    expect((await h.service.start(input)).state).toBe("uncertain");
    expect(h.generator.produceBrief).not.toHaveBeenCalled();
  });
  it("does not invoke teammate after persistence/audit failure", async () => {
    const h = harness();
    h.repository.createTask = vi.fn().mockRejectedValue(new Error("audit failure"));
    expect((await h.service.start(input)).state).toBe("uncertain");
    expect(h.generator.produceBrief).not.toHaveBeenCalled();
    await h.service.start(input);
    expect(h.generator.orchestrate).toHaveBeenCalledTimes(1);
  });
  it.each([null, { ...brief, body: "" }, { ...brief, body: "x".repeat(16001) }, { ...brief, send: true }])("rejects invalid artifact %j", async badBrief => {
    const h = harness();
    h.generator.produceBrief = async () => badBrief;
    expect((await h.service.start(input)).state).toBe("uncertain");
    expect(h.repository.complete).not.toHaveBeenCalled();
  });
  it("keeps completed commit authoritative after a lost response", async () => {
    const h = harness();
    const complete = h.repository.complete;
    h.repository.complete = async (...args) => { await complete(...args); throw new Error("response lost"); };
    expect((await h.service.start(input)).state).toBe("completed");
  });
  it("times out once and rejects late tool invocation", async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      let lateCall: (() => Promise<unknown>) | undefined;
      h.generator.orchestrate = async (_p, createTask) => {
        lateCall = () => createTask(task);
        await new Promise(() => undefined);
      };
      const pending = h.service.start(input);
      await vi.advanceTimersByTimeAsync(30_001);
      expect((await pending).state).toBe("uncertain");
      await expect(lateCall!()).rejects.toThrow("closed");
      expect(h.repository.createTask).not.toHaveBeenCalled();
      await h.service.start(input);
      expect(h.generator.produceBrief).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("rejects invalid fixture before admission", async () => {
    const h = harness();
    await expect(h.service.start({ ...input, fixtureId: "user-data" })).rejects.toThrow();
    expect(h.repository.admit).not.toHaveBeenCalled();
  });
});
