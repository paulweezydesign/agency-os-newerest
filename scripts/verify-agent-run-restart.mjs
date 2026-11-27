// Run crash and recovery separately so the operator can restart their disposable
// Mongo process between phases. This script never stops or resets a database.
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const [mode, fixturePath] = process.argv.slice(2);
if (!["crash", "recover"].includes(mode) || !fixturePath) {
  throw new Error("Usage: node scripts/verify-agent-run-restart.mjs <crash|recover> <new-fixture-path>");
}
const address = new URL(process.env.MONGODB_TEST_URI);
if (address.protocol !== "mongodb:" || !["127.0.0.1", "localhost"].includes(address.hostname) ||
  !address.pathname.includes("test") || address.username || address.password ||
  address.searchParams.get("directConnection") !== "true") throw new Error("Requires disposable loopback test Mongo");
const fixture = path.resolve(fixturePath);
if (mode === "crash") writeFileSync(fixture, JSON.stringify({
  tenantId: `agent-run-restart-test-${randomUUID()}`, evidence: [],
}), { flag: "wx", mode: 0o600 });
const phases = mode === "crash" ? ["claimed", "task_created", "completed"] : ["recover"];
for (const phase of phases) {
  const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run",
    "src/integration/agent-run-restart-mongo.test.ts", "--pool=forks", "--maxWorkers=1"], {
    env: { ...process.env, AGENCYOS_AGENT_RUN_TEST_PHASE: phase, AGENCYOS_AGENT_RUN_TEST_FIXTURE: fixture },
    encoding: "utf8", timeout: 45000,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  if (phase === "recover") {
    if (result.status !== 0) throw new Error("Fresh-process recovery failed");
  } else {
    const evidence = JSON.parse(readFileSync(fixture, "utf8")).evidence.at(-1);
    if (evidence?.run.state !== phase || !evidence.crashReached || result.status !== 1 ||
      !result.stderr.includes("Worker exited unexpectedly")) throw new Error(`Expected worker death not observed: ${phase}`);
    console.log(`VERIFIED intentional SIGKILL after committed ${phase}`);
  }
}
console.log(mode === "crash" ? "Crash evidence saved. Restart disposable Mongo, then run recover with the same fixture." :
  "PASS: fresh processes preserve three durable outcomes without replay. Synthetic fixtures cleaned up.");
