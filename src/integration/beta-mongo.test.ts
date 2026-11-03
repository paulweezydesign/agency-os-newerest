import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createMongoosePolicyGateRepository } from "@/lib/policy-gates/mongoose-policy-gate-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { getClientService } from "@/lib/clients/get-client-service";
import {
  createBetaWorkflowRuntime,
  type BetaWorkflowRuntime,
} from "@/lib/client-pipeline/beta-workflow-runtime";
import * as betaDepsModule from "@/lib/client-pipeline/beta-workflow-deps";
import { loadBetaWorkflowDeps } from "@/lib/client-pipeline/beta-workflow-deps";

const uri = process.env.AGENCYOS_TEST_MONGO_URI;
const phase = process.env.AGENCYOS_TEST_PHASE;
const tenantId = "synthetic-test-tenant";
const repo = createMongoosePolicyGateRepository();
const logs = createMongooseAgentActionLogRepository();
const request = (key: string) => ({
  tenantId,
  actionType: "client_email" as const,
  payload: { to: "lead@example.test" },
  requestedBy: "operator",
  correlationId: key,
  requestKey: key,
});
const decision = (id: string) => ({
  tenantId,
  gateId: id,
  decidedBy: "operator",
  correlationId: "decision-test",
});

describe.skipIf(!uri)("isolated Mongo integration and process restart", () => {
  let runtime: BetaWorkflowRuntime;
  beforeAll(async () => {
    if (
      !uri ||
      !/^mongodb:\/\/127\.0\.0\.1:27027\/agency27_test_[a-z0-9_]+$/.test(uri)
    )
      throw new Error("Only isolated loopback test database is allowed");
    process.env.MONGODB_URI = uri;
    process.env.AGENCYOS_BETA_WORKFLOW = "dry-run";
    await mongoose.connect(uri);
    if (phase === "crash-workflow") {
      const load = betaDepsModule.loadBetaWorkflowDeps;
      vi.spyOn(betaDepsModule, "loadBetaWorkflowDeps").mockImplementation(
        async () => {
          const deps = await load();
          return {
            ...deps,
            pipeline: {
              run: async (input) => {
                const result = await deps.pipeline.run(input);
                // Gate and request audit are durable; route-step output has not returned.
                process.kill(process.pid, "SIGKILL");
                return result;
              },
            },
          };
        },
      );
    }
    runtime = await createBetaWorkflowRuntime();
  });
  afterAll(async () => {
    await runtime?.close();
    await mongoose.disconnect();
  });

  it.skipIf(phase !== "seed")(
    "tests races and persists crash windows for the next Node process",
    async () => {
      const effects = mongoose.connection.db!.collection(
        "fake_effect_evidence",
      );
      const effect = async (input: { idempotencyKey?: string }) => {
        await effects.insertOne({ key: input.idempotencyKey });
      };
      const service = createPolicyGateService(repo, logs, effect);
      const [a, b] = await Promise.all([
        service.request(request("race")),
        service.request(request("race")),
      ]);
      expect(a.id).toBe(b.id);
      await expect(
        service.request({
          ...request("race"),
          payload: { to: "changed@example.test" },
        }),
      ).rejects.toThrow(/conflict/);
      const outcomes = await Promise.allSettled(
        Array.from({ length: 8 }, () => service.approve(decision(a.id))),
      );
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await effects.countDocuments({ key: `${tenantId}:${a.id}` })).toBe(
        1,
      );
      await expect(
        service.approve({ ...decision(a.id), tenantId: "other" }),
      ).rejects.toThrow();

      const crashBefore = await service.request(
        request("claimed-before-effect"),
      );
      await repo.claim(tenantId, crashBefore.id, "operator", "persisted-claim");
      const crashAfter = await service.request(request("completion-failure"));
      const failingRepo = {
        ...repo,
        applyDecision: async () => {
          throw new Error("simulated write failure");
        },
      };
      await expect(
        createPolicyGateService(failingRepo, logs, effect).approve(
          decision(crashAfter.id),
        ),
      ).rejects.toThrow();
      expect(
        (await repo.getByTenantAndId(tenantId, crashAfter.id))?.executionState,
      ).toBe("uncertain");
      const failedEffect = await service.request(request("effect-failure"));
      await expect(
        createPolicyGateService(repo, logs, async () => {
          throw new Error("effect outcome unknown");
        }).approve(decision(failedEffect.id)),
      ).rejects.toThrow();
      const denied = await service.request(request("denied"));
      await service.deny(decision(denied.id));
      await expect(service.approve(decision(denied.id))).rejects.toThrow();

      const raceEffect = vi.fn(async () => undefined);
      const raceService = createPolicyGateService(repo, logs, raceEffect);
      const racingGate = await raceService.request(
        request("deny-approve-race"),
      );
      const decisions = await Promise.allSettled([
        raceService.deny(decision(racingGate.id)),
        raceService.approve(decision(racingGate.id)),
      ]);
      expect(decisions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const raceResult = await repo.getByTenantAndId(tenantId, racingGate.id);
      expect(raceEffect).toHaveBeenCalledTimes(
        raceResult?.status === "approved" ? 1 : 0,
      );

      const clients = await getClientService();
      for (const score of [39, 40, 45, 69, 70]) {
        const client = await clients.create({
          tenantId,
          name: `Example Test Agency ${score}`,
          contactEmail: `lead${score}@example.test`,
        });
        const input = {
          tenantId,
          clientId: client.id,
          leadScore: score,
          requestedBy: "operator",
          correlationId: `run-${score}`,
          workflowRunId: `run-${score}`,
        };
        await Promise.all([runtime.start(input), runtime.start(input)]);
        const state = await runtime.inspect(
          tenantId,
          client.id,
          input.workflowRunId,
        );
        expect(state.state).toBe(score < 40 ? "success" : "suspended");
        expect(state.snapshot).toBeTruthy();
        const persisted = await clients.get(tenantId, client.id);
        expect(persisted?.pipelineStage).toBe(
          score < 40 ? "disqualified" : score < 70 ? "nurture" : "onboard",
        );
        const gates = (await repo.listByTenant(tenantId)).filter(
          (g) => g.workflowRunId === input.workflowRunId,
        );
        expect(gates).toHaveLength(score < 40 ? 0 : 1);
        // Crash after gate creation but before domain-result persistence: rerun
        // the domain step with identical input and prove it returns the same gate.
        const deps = await loadBetaWorkflowDeps();
        const replay = await deps.pipeline.run(input);
        expect(replay.pendingEmailGates.map((g) => g.id)).toEqual(
          gates.map((g) => g.id),
        );
        await runtime.start(input);
        await expect(
          runtime.start({ ...input, leadScore: score + 1 }),
        ).rejects.toThrow(/conflict/);
        await expect(
          runtime.inspect("other", client.id, input.workflowRunId),
        ).rejects.toThrow();
        if (score === 45) await service.deny(decision(gates[0].id));
        if (score === 70) await service.approve(decision(gates[0].id));
        if (score === 40) {
          const waiting = await runtime.resume(
            tenantId,
            client.id,
            input.workflowRunId,
          );
          expect(waiting.state).toBe("suspended");
        }
      }
      const missingEmail = await clients.create({
        tenantId,
        name: "Example Test Agency without contact",
      });
      const noEmailInput = {
        tenantId,
        clientId: missingEmail.id,
        leadScore: 70,
        requestedBy: "operator",
        correlationId: "missing-email",
        workflowRunId: "missing-email",
      };
      expect((await runtime.start(noEmailInput)).state).toBe("success");
      expect(
        (await repo.listByTenant(tenantId, 100)).filter(
          (g) => g.workflowRunId === "missing-email",
        ),
      ).toHaveLength(0);
      await expect(
        runtime.start({
          ...noEmailInput,
          workflowRunId: "invalid-score",
          leadScore: 101,
        }),
      ).rejects.toThrow();
      await expect(
        runtime.start({
          ...noEmailInput,
          workflowRunId: "wrong-tenant",
          tenantId: "other",
        }),
      ).rejects.toThrow(/not found/);
      await expect(
        runtime.start({
          ...noEmailInput,
          workflowRunId: "unknown-client",
          clientId: "000000000000000000000001",
        }),
      ).rejects.toThrow(/not found/);
      expect(await effects.countDocuments()).toBe(3); // race, failed completion, synthetic approval
    },
    60000,
  );

  it.skipIf(!phase?.startsWith("crash-"))(
    "terminates the Node worker at the selected durable crash boundary",
    async () => {
      const key = phase!;
      if (key === "crash-workflow") {
        const clients = await getClientService();
        const client = await clients.create({
          tenantId,
          name: "Example Test Agency crashed workflow",
          contactEmail: "crash@example.test",
        });
        await runtime.start({
          tenantId,
          clientId: client.id,
          leadScore: 70,
          requestedBy: "operator",
          correlationId: "crashed-workflow",
          workflowRunId: "crashed-workflow",
        });
        throw new Error("Expected process death after gate creation");
      }
      const gate = await repo.create(request(key));
      await repo.claim(tenantId, gate.id, "operator", "crash-token");
      if (key === "crash-effect") {
        await mongoose.connection
          .db!.collection("fake_effect_evidence")
          .insertOne(
            { key: `${tenantId}:${gate.id}` },
            { writeConcern: { w: "majority", j: true } },
          );
      }
      // Real process death: no catch/finally, uncertainty write, or graceful disconnect.
      process.kill(process.pid, "SIGKILL");
    },
  );

  it.skipIf(phase !== "recover")(
    "restores Mongo snapshots in a new process without replaying effects",
    async () => {
      const effect = vi.fn(async () => undefined);
      const service = createPolicyGateService(repo, logs, effect);
      const gates = await repo.listByTenant(tenantId, 100);
      for (const key of [
        "race",
        "claimed-before-effect",
        "completion-failure",
        "effect-failure",
        "denied",
        "crash-claim",
        "crash-effect",
      ]) {
        const gate = gates.find((g) => g.requestKey === key)!;
        expect(gate).toBeTruthy();
        await expect(service.approve(decision(gate.id))).rejects.toThrow();
        await expect(service.deny(decision(gate.id))).rejects.toThrow();
      }
      expect(effect).not.toHaveBeenCalled();
      const clients = await getClientService();
      const crashedClient = (await clients.list(tenantId)).find(
        (c) => c.name === "Example Test Agency crashed workflow",
      )!;
      const crashInput = {
        tenantId,
        clientId: crashedClient.id,
        leadScore: 70,
        requestedBy: "operator",
        correlationId: "crashed-workflow",
        workflowRunId: "crashed-workflow",
      };
      const originalGate = gates.find(
        (g) => g.workflowRunId === "crashed-workflow",
      )!;
      expect(originalGate).toMatchObject({
        status: "pending",
        effectRan: false,
      });
      expect((await runtime.start(crashInput)).state).toBe("running");
      await expect(
        runtime.resume(tenantId, crashedClient.id, "crashed-workflow"),
      ).rejects.toThrow(/not safely resumable/);
      const recoveredGates = (await repo.listByTenant(tenantId, 100)).filter(
        (g) => g.workflowRunId === "crashed-workflow",
      );
      expect(recoveredGates.map((g) => g.id)).toEqual([originalGate.id]);

      for (const score of [39, 40, 45, 69, 70]) {
        const client = (await clients.list(tenantId)).find(
          (c) => c.name === `Example Test Agency ${score}`,
        )!;
        expect(client.contactEmail).toBe(`lead${score}@example.test`);
        const saved = await runtime.inspect(
          tenantId,
          client.id,
          `run-${score}`,
        );
        expect(saved.snapshot).toBeTruthy();
        if (score === 45 || score === 70) {
          const finished = await runtime.resume(
            tenantId,
            client.id,
            `run-${score}`,
          );
          expect(finished.state).toBe("success");
        }
        const entries = await logs.listByCorrelationId(
          tenantId,
          `run-${score}`,
        );
        expect(entries.some((e) => e.toolName === "clientPipeline.route")).toBe(
          true,
        );
      }
      expect(
        await mongoose.connection
          .db!.collection("fake_effect_evidence")
          .countDocuments(),
      ).toBe(4);
    },
    60000,
  );
});
