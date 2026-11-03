import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Requires the isolated Docker instance documented in docs/issue-27-verification.md.
// Never accepts a production URI; leaves evidence in a unique local database.
const db = `agency27_test_${randomUUID().replaceAll("-", "")}`;
const uri = `mongodb://127.0.0.1:27027/${db}`;
console.log(`Local evidence database: ${db}`);
for (const phase of [
  "seed",
  "crash-claim",
  "crash-effect",
  "crash-workflow",
  "recover",
]) {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "src/integration/beta-mongo.test.ts",
    ],
    {
      env: {
        ...process.env,
        AGENCYOS_TEST_MONGO_URI: uri,
        AGENCYOS_TEST_PHASE: phase,
      },
      encoding: "utf8",
      timeout: 120000,
    },
  );
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (phase.startsWith("crash-")) {
    if (
      result.status !== 1 ||
      !`${result.stdout}${result.stderr}`.includes("Worker exited unexpectedly")
    ) {
      throw new Error(
        `Expected abrupt worker death in ${phase}; got ${result.status}`,
      );
    }
    console.log(`Expected process crash verified: ${phase}`);
  } else if (result.status !== 0) {
    throw new Error(`Mongo verification failed during ${phase}`);
  }
}
console.log("Mongo restart acceptance passed; evidence retained in " + db);
