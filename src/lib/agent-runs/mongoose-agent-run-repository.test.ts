import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectModel } from "@/lib/projects/project-model";
import { getTaskModel } from "@/lib/tasks/task-model";
import { getProjectArtifactModel } from "@/lib/project-artifacts/artifact-model";
import { getAgentActionLogModel } from "@/lib/agent-action-logs/agent-action-log-model";
import { getAgentRunModel } from "./agent-run-model";
import { createMongooseAgentRunRepository } from "./mongoose-agent-run-repository";
import { createAgentRunService } from "./agent-run-service";
import { FIXTURE, type AgentRun } from "./schemas";

const uri = process.env.MONGODB_TEST_URI;
// Explicit opt-in; never connect to a production or remote database from this suite.
const enabled = !!uri && /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/[^?]*test[^?]*(\?|$)/.test(uri);
const tenantId = `agent-run-test-${randomUUID()}`;
const task = { title: "Synthetic Task", description: "Write an internal fictional brief" };
const brief = { title: "Synthetic brief", body: "Fictional content only" };
let run: AgentRun;
const repository = createMongooseAgentRunRepository();

describe.skipIf(!enabled)("AgentRun Mongo transactions (opt-in replica set)", () => {
  beforeAll(async () => {
    await mongoose.connect(uri!);
    await Promise.all([getProjectModel().init(), getTaskModel().init(), getProjectArtifactModel().init(), getAgentActionLogModel().init(), getAgentRunModel().init()]);
  });
  beforeEach(async () => {
    const project = await new (getProjectModel())({ tenantId, clientId: "fictional", name: "Synthetic Project", budget: 0, timelineStart: "2026-01-01", timelineEnd: "2026-01-02" }).save();
    run = { tenantId, projectId: project._id.toString(), runId: randomUUID(), actorId: "test-operator", fixtureId: FIXTURE.id, modelId: "injected-test-model", state: "claimed", taskId: null, taskTitle: null, taskDescription: null, artifactId: null };
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await Promise.all([getProjectModel().deleteMany({ tenantId }), getTaskModel().deleteMany({ tenantId }), getProjectArtifactModel().deleteMany({ tenantId }), getAgentActionLogModel().deleteMany({ tenantId }), getAgentRunModel().deleteMany({ tenantId })]);
    await mongoose.disconnect();
  });
  it("persists one Task, brief, done state and correlated audit across replay", async () => {
    expect((await repository.admit(run)).admitted).toBe(true);
    const assigned = await repository.createTask(run, task);
    const completed = await repository.complete(run, brief);
    expect(completed).toMatchObject({ state: "completed", taskId: assigned.taskId });
    expect(completed.artifactId).toBeTruthy();
    expect((await repository.admit(run)).admitted).toBe(false);
    expect(await repository.complete(run, brief)).toEqual(completed);
    const scope = { tenantId, projectId: run.projectId };
    expect(await getTaskModel().countDocuments(scope)).toBe(1);
    expect(await getProjectArtifactModel().countDocuments(scope)).toBe(1);
    expect((await getTaskModel().findOne(scope))!.status).toBe("done");
    expect(await getAgentActionLogModel().countDocuments({ ...scope, correlationId: `agent-run:${run.runId}`, status: "success" })).toBe(3);
    expect(await repository.inspect({ ...run, tenantId: "other" })).toBeNull();
  });
  it("concurrent admission executes only one claimant and rejects replacement identity", async () => {
    const results = await Promise.allSettled([repository.admit(run), repository.admit(run)]);
    expect(results.filter(r => r.status === "fulfilled" && r.value.admitted)).toHaveLength(1);
    // A write-conflict loser may reject before the winning commit becomes visible;
    // it never receives execution permission and a later inspection is safe.
    expect(await repository.inspect(run)).not.toBeNull();
    await expect(repository.admit({ ...run, runId: randomUUID() })).rejects.toThrow();
    await expect(repository.admit({ ...run, modelId: "changed" })).rejects.toThrow();
  });
  it("rolls back Task and checkpoint when audit fails", async () => {
    await repository.admit(run);
    const spy = vi.spyOn(getAgentActionLogModel().prototype, "save").mockRejectedValueOnce(new Error("injected audit failure"));
    await expect(repository.createTask(run, task)).rejects.toThrow("audit failure");
    spy.mockRestore();
    expect(await getTaskModel().countDocuments({ tenantId, projectId: run.projectId })).toBe(0);
    expect((await repository.inspect(run))!.state).toBe("claimed");
  });
  it("rolls back artifact and Task completion when audit fails", async () => {
    await repository.admit(run);
    await repository.createTask(run, task);
    const spy = vi.spyOn(getAgentActionLogModel().prototype, "save").mockRejectedValueOnce(new Error("injected audit failure"));
    await expect(repository.complete(run, brief)).rejects.toThrow("audit failure");
    spy.mockRestore();
    const scope = { tenantId, projectId: run.projectId };
    expect(await getProjectArtifactModel().countDocuments(scope)).toBe(0);
    expect((await getTaskModel().findOne(scope))!.status).toBe("in_progress");
    expect((await repository.inspect(run))!.state).toBe("task_created");
  });
  it("uncertainty remains blocked while a completed commit is never overwritten", async () => {
    await repository.admit(run);
    await repository.markUncertain(run);
    expect((await repository.inspect(run))!.state).toBe("uncertain");
    await expect(repository.createTask(run, task)).rejects.toThrow();
    expect((await repository.admit(run)).admitted).toBe(false);
  });
  it("reconciles a lost completion response from durable state without replay", async () => {
    const generator = {
      modelId: run.modelId,
      orchestrate: vi.fn(async (_prompt, createTask) => { await createTask(task); }),
      produceBrief: vi.fn(async () => brief),
    };
    const service = createAgentRunService({
      ...repository,
      complete: async (...args) => {
        await repository.complete(...args);
        throw new Error("injected lost response after commit");
      },
    }, generator);
    const completed = await service.start(run);
    expect(completed.state).toBe("completed");
    expect(await service.start(run)).toEqual(completed);
    expect(generator.orchestrate).toHaveBeenCalledTimes(1);
    expect(generator.produceBrief).toHaveBeenCalledTimes(1);
    const scope = { tenantId, projectId: run.projectId };
    expect(await getTaskModel().countDocuments(scope)).toBe(1);
    expect(await getProjectArtifactModel().countDocuments(scope)).toBe(1);
    expect(await getAgentActionLogModel().countDocuments({ ...scope, correlationId: `agent-run:${run.runId}` })).toBe(3);
  });
  it("does not overwrite committed completion with uncertainty", async () => {
    await repository.admit(run);
    await repository.createTask(run, task);
    await repository.complete(run, brief);
    await repository.markUncertain(run);
    expect((await repository.inspect(run))!.state).toBe("completed");
  });
  it("rejects a changed or tracker-bound Task before artifact commit", async () => {
    await repository.admit(run);
    const assigned = await repository.createTask(run, task);
    await getTaskModel().updateOne({ _id: assigned.taskId }, { $set: { mondayItemId: "bound" } });
    await expect(repository.complete(run, brief)).rejects.toThrow("changed");
    expect(await getProjectArtifactModel().countDocuments({ tenantId, projectId: run.projectId })).toBe(0);
  });
  it("cannot complete a Task whose scope changed during teammate generation", async () => {
    const service = createAgentRunService(repository, {
      modelId: run.modelId,
      orchestrate: async (_prompt, createTask) => { await createTask(task); },
      produceBrief: async () => {
        const assigned = await repository.inspect(run);
        await getTaskModel().updateOne({ _id: assigned!.taskId }, { $set: { description: "Human changed scope" } });
        return brief;
      },
    });
    expect((await service.start(run)).state).toBe("uncertain");
    const scope = { tenantId, projectId: run.projectId };
    expect(await getProjectArtifactModel().countDocuments(scope)).toBe(0);
    expect((await getTaskModel().findOne(scope))!.status).toBe("in_progress");
  });
  it("does not admit a GitHub-bound Project", async () => {
    await getProjectModel().updateOne({ _id: run.projectId }, { $set: { githubRepo: "fictional/repo" } });
    await expect(repository.admit(run)).rejects.toThrow("unavailable");
    expect(await repository.inspect(run)).toBeNull();
  });
});
