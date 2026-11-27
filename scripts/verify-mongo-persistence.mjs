// A separate Node process reads durable evidence left by the integration suite.
import mongoose from "mongoose";

const uri = process.env.MONGODB_TEST_URI;
const fixture = JSON.parse(process.argv[2]);
const address = new URL(uri);
if (!["localhost", "127.0.0.1"].includes(address.hostname) ||
    !address.pathname.includes("test")) {
  throw new Error("Persistence verification requires a local test database");
}
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
try {
  const db = mongoose.connection.db;
  const client = await db.collection("clients").findOne({
    _id: new mongoose.Types.ObjectId(fixture.clientId), tenantId: fixture.tenantId,
  });
  const run = await db.collection("clientpipelineruns").findOne({
    tenantId: fixture.tenantId, runId: fixture.runId,
  });
  const gate = await db.collection("policygates").findOne({
    _id: new mongoose.Types.ObjectId(fixture.gateId), tenantId: fixture.tenantId,
  });
  const logs = await db.collection("agentactionlogs").countDocuments({
    tenantId: fixture.tenantId, correlationId: fixture.correlationId,
  });
  if (!client || !run || !gate || !logs) throw new Error("Missing durable evidence");
  process.stdout.write(JSON.stringify({
    client: { name: client.name, contactEmail: client.contactEmail,
      leadScore: client.leadScore, pipelineStage: client.pipelineStage, workflowRunId: client.workflowRunId },
    run: { runId: run.runId, correlationId: run.correlationId, status: run.status },
    gate: { status: gate.status, effectRan: gate.effectRan, effectReceipt: gate.effectReceipt },
    logs,
  }));
} finally {
  await mongoose.disconnect();
}
