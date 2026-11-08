import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { describe, it, expect, vi } from "vitest";
import { MongoDBStore } from "@mastra/mongodb";
import { getClientService } from "@/lib/clients/get-client-service";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import { getClientPipelineRunModel } from "@/lib/client-pipeline/workflow-model";
import { executeClientPipelineWorkflow, resumeClientPipelineWorkflow, getClientPipelineWorkflowRun } from "@/lib/client-pipeline/workflow-service";
import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
const phase = process.env.AGENCY30_PHASE;
const file = process.env.AGENCY30_FIXTURE;
const uri = process.env.MONGODB_TEST_URI;
describe.skipIf(!phase || !file || !uri)("process death and Mongo restart", () => {
  it("restores real engine snapshots across fresh processes", async () => {
    const address = new URL(uri!);
    if (address.hostname !== "127.0.0.1" || !address.pathname.includes("test")) throw new Error("Local synthetic Mongo only");
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri!);
    const newInput = async () => {
      const tenantId = `restart-${randomUUID()}`;
      const client = await (await getClientService()).create({ tenantId, name: "Restart test", contactEmail: "restart@example.test" });
      return { tenantId, clientId: client.id, runId: randomUUID(), correlationId: randomUUID(), operatorId: "test", leadScore: 70 };
    };
    try {
      if (phase === "seed") {
        const input = await newInput();
        const run = await executeClientPipelineWorkflow(input);
        expect(run.engineState).toBe("suspended");
        const gate = await (await getPolicyGateService()).approve({ tenantId: input.tenantId, gateId: run.gates[0].id, decidedBy: "test", correlationId: input.correlationId });
        const audit = await createMongooseAgentActionLogRepository().listByCorrelationId(input.tenantId, input.correlationId);
        writeFileSync(file!, JSON.stringify({ input, gate, mastraRunId: run.mastraRunId, routingIds: audit.filter((entry) => entry.toolName === "clientPipeline.workflow.scored-and-routed").map((entry) => entry.id) }));
      } else if (phase === "crash") {
        const fixture = JSON.parse(readFileSync(file!, "utf8"));
        const crashInput = await newInput();
        writeFileSync(file!, JSON.stringify({ ...fixture, crashInput }));
        const collection = getClientPipelineRunModel().collection;
        const original = collection.updateOne.bind(collection);
        vi.spyOn(collection, "updateOne").mockImplementation(async (...args) => {
          if ((args[1] as { $set?: { result?: unknown } }).$set?.result) {
            writeFileSync(file!, JSON.stringify({ ...fixture, crashInput, crashReached: true }));
            process.kill(process.pid, "SIGKILL");
          }
          return original(...args);
        });
        await executeClientPipelineWorkflow(crashInput);
        throw new Error("Crash injection did not execute");
      } else if (phase === "recover") {
        const { input, gate, routingIds, crashInput, mastraRunId } = JSON.parse(readFileSync(file!, "utf8"));
        const storage = new MongoDBStore({ id: "restart-evidence", uri: uri!, dbName: mongoose.connection.db!.databaseName });
        try {
          const workflows = await storage.getStore("workflows");
          const before = await workflows!.loadWorkflowSnapshot({ workflowName: "client-pipeline", runId: mastraRunId });
          expect(before?.status).toBe("suspended");
          expect((await getClientPipelineWorkflowRun(input.tenantId, input.runId))?.engineState).toBe("suspended");
          const result = await resumeClientPipelineWorkflow(input.tenantId, input.clientId, input.runId);
          expect(result.engineState).toBe("success");
          expect(result.gates[0].id).toBe(gate.id);
          expect(result.gates[0].effectReceipt).toEqual(gate.effectReceipt);
          const audit = await createMongooseAgentActionLogRepository().listByCorrelationId(input.tenantId, input.correlationId);
          expect(audit.filter((entry) => entry.toolName === "clientPipeline.workflow.scored-and-routed").map((entry) => entry.id)).toEqual(routingIds);
          expect((await workflows!.loadWorkflowSnapshot({ workflowName: "client-pipeline", runId: mastraRunId }))?.status).toBe("success");
          const blocked = await executeClientPipelineWorkflow(crashInput);
          expect(blocked.engineState).toBe("running");
          expect(blocked.gates).toHaveLength(1);
          await expect(resumeClientPipelineWorkflow(crashInput.tenantId, crashInput.clientId, crashInput.runId)).rejects.toMatchObject({ status: 409 });
          expect((await (await getPolicyGateService()).list(crashInput.tenantId))).toHaveLength(1);
          console.log("VERIFIED: Mongo snapshot suspended -> success in fresh process; original route audit IDs and receipt unchanged; killed engine remains blocked with one gate.");
        } finally { await storage.close(); }
      } else throw new Error("Unknown verification phase");
    } finally { await mongoose.disconnect(); }
  }, 30000);
});
