#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "--pool=threads", "src/lib/demo/seed-data.test.ts"],
  { stdio: "inherit", shell: false },
);

process.exit(result.status ?? 1);
