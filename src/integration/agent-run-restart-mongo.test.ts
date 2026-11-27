import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { getProjectModel } from "@/lib/projects/project-model";
import { getTaskModel } from "@/lib/tasks/task-model";
import { getProjectArtifactModel } from "@/lib/project-artifacts/artifact-model";
import { getAgentActionLogModel } from "@/lib/agent-action-logs/agent-action-log-model";
import { getAgentRunModel } from "@/lib/agent-runs/agent-run-model";
import { createMongooseAgentRunRepository } from "@/lib/agent-runs/mongoose-agent-run-repository";
import { createAgentRunService } from "@/lib/agent-runs/agent-run-service";
import { FIXTURE, type AgentRun } from "@/lib/agent-runs/schemas";

const phase = process.env.AGENCYOS_AGENT_RUN_TEST_PHASE;
const file = process.env.AGENCYOS_AGENT_RUN_TEST_FIXTURE;
const uri = process.env.MONGODB_TEST_URI;
type Evidence = { run: AgentRun; auditIds: string[]; workerPid: number; crashReached: boolean };
type Fixture = { tenantId: string; evidence: Evidence[] };

describe.skipIf(!phase || !file || !uri)("AgentRun real process death (opt-in replica set)", () => {
  it("keeps committed claims and outputs authoritative without replay", async () => {
    const address = new URL(uri!);
    if (address.protocol !== "mongodb:" || !["127.0.0.1", "localhost"].includes(address.hostname) ||
      !address.pathname.includes("test") || address.username || address.password ||
      address.searchParams.get("directConnection") !== "true") throw new Error("Disposable loopback test Mongo only");
    const fixture: Fixture = JSON.parse(readFileSync(file!, "utf8"));
    if (!fixture.tenantId.startsWith("agent-run-restart-test-")) throw new Error("Invalid synthetic tenant");
    await mongoose.connect(uri!, { serverSelectionTimeoutMS: 10000 });
    const models = [getProjectModel(), getTaskModel(), getProjectArtifactModel(), getAgentActionLogModel(), getAgentRunModel()];
    const repository = createMongooseAgentRunRepository();
    try {
      await Promise.all(models.map(model => model.init()));
      const audits = async (run: AgentRun) => (await getAgentActionLogModel().find({
        tenantId: run.tenantId, projectId: run.projectId, correlationId: `agent-run:${run.runId}`,
      }).sort({ _id: 1 }).exec()).map(log => log._id.toString());
      if (phase === "recover") {
        expect(fixture.evidence.map(item => item.run.state)).toEqual(["claimed", "task_created", "completed"]);
        const generator = {
          modelId: "injected-restart-test-model",
          orchestrate: vi.fn(async () => { throw new Error("Must not replay orchestrator"); }),
          produceBrief: vi.fn(async () => { throw new Error("Must not replay teammate"); }),
        };
        const service = createAgentRunService(repository, generator);
        for (const evidence of fixture.evidence) {
          expect(evidence.crashReached).toBe(true);
          expect(evidence.workerPid).not.toBe(process.pid);
          expect(await service.inspect(evidence.run)).toEqual(evidence.run);
          expect(await service.start(evidence.run)).toEqual(evidence.run);
          expect(await audits(evidence.run)).toEqual(evidence.auditIds);
          const scope = { tenantId: fixture.tenantId, projectId: evidence.run.projectId };
          expect(await getTaskModel().countDocuments(scope)).toBe(evidence.run.taskId ? 1 : 0);
          expect(await getProjectArtifactModel().countDocuments(scope)).toBe(evidence.run.artifactId ? 1 : 0);
          if (evidence.run.taskId) {
            expect((await getTaskModel().findById(evidence.run.taskId))?.toObject())
              .toMatchObject({ ...scope, status: evidence.run.state === "completed" ? "done" : "in_progress" });
          }
          if (evidence.run.artifactId) {
            expect((await getProjectArtifactModel().findById(evidence.run.artifactId))?.toObject())
              .toMatchObject({ ...scope, kind: "brief", title: "Synthetic brief", body: "Fictional content only" });
          }
          await expect(service.start({ ...evidence.run, runId: randomUUID() })).rejects.toThrow();
        }
        expect(generator.orchestrate).not.toHaveBeenCalled();
        expect(generator.produceBrief).not.toHaveBeenCalled();
        await Promise.all(models.map(model => model.collection.deleteMany({ tenantId: fixture.tenantId })));
        console.log("VERIFIED: three killed workers; fresh-process replay invokes no generator; Task, artifact and audit IDs unchanged.");
      } else {
        if (!["claimed", "task_created", "completed"].includes(phase!)) throw new Error("Unknown crash phase");
        const project = await new (getProjectModel())({
          tenantId: fixture.tenantId, clientId: "fictional", name: "Synthetic restart Project", budget: 0,
          timelineStart: "2026-01-01", timelineEnd: "2026-01-02",
        }).save();
        const input = { tenantId: fixture.tenantId, projectId: project._id.toString(), runId: randomUUID(),
          actorId: "test-operator", fixtureId: FIXTURE.id };
        const crash = async () => {
          const run = (await repository.inspect(input))!;
          expect(run.state).toBe(phase);
          fixture.evidence.push({ run, auditIds: await audits(run), workerPid: process.pid, crashReached: true });
          writeFileSync(file!, JSON.stringify(fixture), { mode: 0o600 });
          process.kill(process.pid, "SIGKILL");
          throw new Error("SIGKILL did not terminate worker");
        };
        const complete = repository.complete;
        if (phase === "completed") repository.complete = async (...args) => { await complete(...args); return crash(); };
        const service = createAgentRunService(repository, {
          modelId: "injected-restart-test-model",
          orchestrate: async (_prompt, createTask) => {
            if (phase === "claimed") await crash();
            await createTask({ title: "Synthetic Task", description: "Internal fictional brief" });
          },
          produceBrief: async () => {
            if (phase === "task_created") await crash();
            return { title: "Synthetic brief", body: "Fictional content only" };
          },
        });
        await service.start(input);
        throw new Error("Expected crash did not happen");
      }
    } finally { await mongoose.disconnect(); }
  }, 30000);
});
