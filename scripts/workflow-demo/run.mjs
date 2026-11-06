import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, mkdir, cp, symlink, writeFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoDBStore } from "@mastra/mongodb";
import { chromium } from "playwright";
import { validateDockerEndpoint, assertLocalContext, parseDemoArgs, demoEnvironment, summarizeEvidence } from "./config.mjs";
import { verifyOperatorFlow } from "./browser.mjs";

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
assertLocalContext();
const options = parseDemoArgs(process.argv.slice(2));
if (options.hold && !process.stdin.isTTY) throw new Error("--hold requires an interactive terminal; omit it for acceptance checks");
const id = randomBytes(8).toString("hex");
const container = `agency-demo-${id}`;
const database = `agency_demo_test_${id}`;
const output = path.join(root, ".scratch/demo-evidence", id);
const workspace = await mkdtemp(path.join(tmpdir(), "agency-demo-"));
await mkdir(output, { recursive: true });
const evidence = { source: {}, database, fontMode: "local-font-mock", browser: "", checks: [], errors: [], externalRequests: [], workflowRequests: [], records: [], passed: false };
let child, browser, storage, dockerEndpoint;
const dockerEnv = { ...process.env };
delete dockerEnv.DOCKER_HOST; delete dockerEnv.DOCKER_CONTEXT;
const docker = args => execute("docker", ["--host", dockerEndpoint, ...args], { env: dockerEnv });
let containerAttempted = false;
let interrupted = false;
const shutdown = () => { interrupted = true; child?.kill("SIGTERM"); };
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const { stdout: sha } = await execute("git", ["rev-parse", "HEAD"], { cwd: root });
  const { stdout: status } = await execute("git", ["status", "--porcelain=v1"], { cwd: root });
  evidence.source = { commit: sha.trim(), dirty: Boolean(status.trim()) };
  let endpoint = process.env.DOCKER_HOST;
  if (process.env.DOCKER_CONTEXT || !endpoint) {
    const { stdout } = await execute("docker", ["context", "inspect", ...(process.env.DOCKER_CONTEXT ? [process.env.DOCKER_CONTEXT] : [])]);
    endpoint = JSON.parse(stdout)[0]?.Endpoints?.docker?.Host;
  }
  dockerEndpoint = validateDockerEndpoint(endpoint);
  await docker(["image", "inspect", "mongo:7"]);
  // Only these source/config files enter the temporary app; no env file is copied.
  for (const entry of ["src", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs", "next-env.d.ts"]) {
    await cp(path.join(root, entry), path.join(workspace, entry), { recursive: true });
  }
  await cp(path.join(root, "public"), path.join(workspace, "public"), { recursive: true }).catch(error => { if (error.code !== "ENOENT") throw error; });
  await symlink(path.join(root, "node_modules"), path.join(workspace, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  containerAttempted = true;
  await docker(["run", "--detach", "--rm", "--name", container, "--label", `agencyos.local-demo=${id}`, "--publish", "127.0.0.1::27017", "mongo:7"]);
  const { stdout: inspected } = await docker(["inspect", container]);
  const metadata = JSON.parse(inspected)[0];
  const binding = metadata.NetworkSettings.Ports["27017/tcp"][0];
  if (binding.HostIp !== "127.0.0.1") throw new Error("Mongo binding is not loopback");
  const uri = `mongodb://127.0.0.1:${binding.HostPort}/${database}`;
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  const env = demoEnvironment({ uri, port, secret: randomBytes(32).toString("hex"), fontMock: path.join(root, "scripts/workflow-demo/fonts.cjs") });
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const version = await mongoose.connection.db.admin().serverInfo(); evidence.mongoVersion = version.version;
  child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: workspace, env, stdio: ["ignore", "pipe", "pipe"] });
  const log = createWriteStream(path.join(output, "server.log")); child.stdout.pipe(log); child.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 120 && !interrupted; attempt++) {
    if (child.exitCode !== null) throw new Error("Local app exited; see server.log");
    try { const response = await fetch(`${url}/signin`, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch { /* compiling */ }
    await delay(500);
  }
  if (!ready) throw new Error("Local app did not become ready");
  browser = await chromium.launch({ headless: !options.headed, ...(options.chromium ? { executablePath: options.chromium } : {}), ...(options.noSandbox ? { args: ["--no-sandbox"] } : {}) });
  evidence.browser = browser.version();
  const { clientIds, page } = await verifyOperatorFlow({ browser, url, db: mongoose.connection.db, evidence });
  storage = new MongoDBStore({ id: "demo-evidence", uri, dbName: database });
  const workflows = await storage.getStore("workflows");
  for (const clientId of clientIds) {
    const client = await mongoose.connection.db.collection("clients").findOne({ _id: new mongoose.Types.ObjectId(clientId), tenantId: "tenant-default" });
    const run = await mongoose.connection.db.collection("clientpipelineruns").findOne({ clientId, tenantId: "tenant-default" });
    const gate = await mongoose.connection.db.collection("policygates").findOne({ tenantId: "tenant-default", requestKey: `client-pipeline:${run.runId}` });
    const logs = await mongoose.connection.db.collection("agentactionlogs").find({ tenantId: "tenant-default", correlationId: run.correlationId }).toArray();
    assert.ok(client && run && gate, "Synthetic records must exist");
    assert.equal(await mongoose.connection.db.collection("clientpipelineruns").countDocuments({ clientId, tenantId: "tenant-default" }), 1);
    assert.equal(await mongoose.connection.db.collection("policygates").countDocuments({ tenantId: "tenant-default", requestKey: `client-pipeline:${run.runId}` }), 1);
    assert.equal(gate.dryRun, true);
    assert.ok(["approved", "denied"].includes(gate.status));
    const expectedScore = gate.status === "denied" ? 45 : 70;
    assert.equal(client.leadScore, expectedScore);
    assert.equal(client.pipelineStage, expectedScore === 70 ? "onboard" : "nurture");
    if (gate.status === "denied") {
      assert.equal(gate.effectRan, false);
      assert.equal(gate.effectReceipt, undefined);
    }
    for (const tool of ["clientPipeline.workflow.input-persisted", "clientPipeline.workflow.scored-and-routed", "clientPipeline.workflow.approval-boundary-persisted", "policyGates.request"]) assert.ok(logs.some(log => log.toolName === tool && log.status === "success"), `Missing audit stage: ${tool}`);
    assert.ok(logs.some(log => ["policyGates.approve", "policyGates.deny", "policyGates.recover"].includes(log.toolName) && log.status === "success"));
    const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: "client-pipeline", runId: run.mastraRunId });
    if (run.engineState !== "success" || snapshot?.status !== "success" || !logs.length || (gate.status === "approved" && (!gate.dryRun || !gate.effectRan || gate.effectReceipt?.key !== `policy-gate:${gate._id}`))) throw new Error("Persisted receipt/audit/engine evidence incomplete");
    evidence.records.push(summarizeEvidence({ client, run, gate, logs, snapshotStatus: snapshot.status }));
  }
  await page.screenshot({ path: path.join(output, "completed-workflow.png"), fullPage: true });
  evidence.workflowPassed = true;
  console.log("Verified persisted Client, run, gate, receipt, audit and engine snapshots; cleanup remains.");
  if (options.hold) {
    console.log(`Demo remains open at ${url}. Ctrl+C stops the owned app/container. Use a NEW synthetic Client for each new scenario.`);
    while (!interrupted) await delay(250);
  }
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : "Demo failed";
  console.error(evidence.failure, `Evidence: ${output}`); process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(5000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await storage?.close().catch(() => {}); await mongoose.disconnect().catch(() => {});
  try {
    if (containerAttempted) {
      const inspection = await docker(["inspect", container]).catch(error => {
        if (String(error.stderr).includes("No such object") || String(error.stderr).includes("No such container")) return null;
        throw error;
      });
      if (inspection) {
        const owned = JSON.parse(inspection.stdout)[0];
        if (owned.Config?.Labels?.["agencyos.local-demo"] !== id) throw new Error("Container ownership could not be verified; no cleanup attempted");
        await docker(["rm", "--force", container]);
      }
    }
    await rm(workspace, { recursive: true, force: true });
    evidence.cleanupPassed = true;
  } catch (error) {
    evidence.cleanupError = error.message;
    console.error("Cleanup failed:", error.message);
    process.exitCode = 1;
  }
  evidence.passed = Boolean(evidence.workflowPassed && evidence.cleanupPassed && !evidence.failure);
  await writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2));
  process.off("SIGINT", shutdown); process.off("SIGTERM", shutdown);
  if (evidence.passed) console.log(`PASS: acceptance and cleanup complete. Evidence: ${output}`);
}
