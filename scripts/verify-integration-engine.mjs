import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const uri = process.env.MONGODB_TEST_URI;
const address = new URL(uri);
if (address.hostname !== "127.0.0.1" || !address.pathname.includes("test")) throw new Error("Requires a local test database");
const container = process.env.AGENCY30_MONGO_CONTAINER;
if (!container || !/^[a-zA-Z0-9_-]+$/.test(container)) throw new Error("Explicit local test Mongo container name required");
const inspect = spawnSync("docker", ["inspect", container], { encoding: "utf8" });
if (inspect.status !== 0) throw new Error("Cannot inspect local test container");
const metadata = JSON.parse(inspect.stdout)[0];
if (!metadata.Config.Image.startsWith("mongo:") || !(metadata.HostConfig.PortBindings["27017/tcp"] ?? []).some((entry) => entry.HostIp === "127.0.0.1" && entry.HostPort === address.port)) throw new Error("Container must be matching loopback Mongo test process");
const fixture = path.join(mkdtempSync(path.join(tmpdir(), "agency30-engine-")), "fixture.json");
for (const phase of ["seed", "crash", "recover"]) {
  if (phase === "recover") {
    const restart = spawnSync("docker", ["restart", container], { encoding: "utf8" });
    if (restart.status !== 0) throw new Error("Local Mongo restart failed");
    console.log("Restarted local Mongo test process", container);
  }
  const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "src/integration/engine-restart-mongo.test.ts", "--maxWorkers=1"], {
    env: { ...process.env, AGENCY30_PHASE: phase, AGENCY30_FIXTURE: fixture }, encoding: "utf8", timeout: 60000,
  });
  console.log(`PHASE ${phase}: exit ${result.status}, signal ${result.signal}`);
  process.stdout.write(result.stdout); process.stderr.write(result.stderr);
  // The crash phase kills the actual Node process; no catch/finally can persist an outcome.
  if (phase === "crash") {
    if (!JSON.parse(readFileSync(fixture, "utf8")).crashReached || result.status !== 1 || !result.stderr.includes("Worker exited unexpectedly")) throw new Error("Expected process death was not observed");
  } else if (result.status !== 0) throw new Error(`Verification failed: ${phase}`);
}
console.log("PASS: actual process death, local Mongo restart, fresh-process Mastra resume");
