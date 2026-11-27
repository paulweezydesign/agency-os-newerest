import { describe, expect, it } from "vitest";
import { validateDockerEndpoint, assertLocalContext, demoEnvironment, parseDemoArgs, validateDemoMongo, summarizeEvidence } from "../../../scripts/workflow-demo/config.mjs";

describe("isolated workflow demo runner", () => {
  it("rejects remote Docker daemons", () => {
    expect(validateDockerEndpoint("unix:///var/run/docker.sock")).toContain("unix:");
    expect(validateDockerEndpoint("npipe:////./pipe/docker_engine")).toContain("npipe:");
    for (const endpoint of ["ssh://host", "tcp://remote:2375", "tcp://127.0.0.1:2375", undefined]) expect(() => validateDockerEndpoint(endpoint)).toThrow(/local Docker/);
  });
  it("rejects remote/shared database targets", () => {
    for (const uri of ["mongodb://example.com/agency_demo_test_x", "mongodb://127.0.0.1/production", "mongodb://user:password@127.0.0.1/agency_demo_test_x", "mongodb://127.0.0.1/agency_demo_test_x?authSource=admin"]) {
      expect(() => validateDemoMongo(uri)).toThrow();
    }
    expect(validateDemoMongo("mongodb://127.0.0.1:27027/agency_demo_test_0123abcd")).toBe("agency_demo_test_0123abcd");
  });
  it("constructs an allowlisted environment without inherited credentials or production flags", () => {
    const env = demoEnvironment({ uri: "mongodb://127.0.0.1:27027/agency_demo_test_0123abcd", port: 3100, secret: "ephemeral-test-only", fontMock: "/tmp/fonts.cjs", parent: { NODE_ENV: "development", PATH: "/usr/bin", AUTH_GITHUB_SECRET: "must-not-copy", MONGODB_URI: "remote" } });
    expect(env.NODE_ENV).toBe("development");
    expect(env.AGENCYOS_DRY_RUN_WORKFLOW).toBe("true");
    expect(env).not.toHaveProperty("AUTH_GITHUB_SECRET");
    expect(env).not.toHaveProperty("VERCEL_ENV");
    expect(env.AUTH_URL).toBe("http://127.0.0.1:3100");
    expect(env.MONGODB_URI).toMatch(/agency_demo_test_/);
  });
  it("rejects hosted or production contexts before enabling demo auth", () => {
    for (const parent of [{ NODE_ENV: "production" }, { NODE_ENV: "development", VERCEL: "1" }, { NODE_ENV: "development", CI: "true" }]) expect(() => assertLocalContext(parent as NodeJS.ProcessEnv)).toThrow(/local/);
  });
  it("accepts only local browser/display options, never remote targets", () => {
    expect(parseDemoArgs(["--headed", "--hold", "--chromium=/usr/bin/chromium"])).toMatchObject({ headed: true, hold: true, chromium: "/usr/bin/chromium" });
    for (const flag of ["--url=https://example.com", "--mongo=remote", "--deploy", "--unknown"]) expect(() => parseDemoArgs([flag])).toThrow();
  });
  it("exports only the selected synthetic evidence fields", () => {
    const evidence = summarizeEvidence({ client: { _id: "c", name: "Demo", pipelineStage: "onboard", leadScore: 70, secret: "omit" }, run: { runId: "r", correlationId: "q", mastraRunId: "m", engineState: "success", input: { secret: "omit" } }, gate: { _id: "g", status: "approved", dryRun: true, effectRan: true, effectReceipt: { key: "receipt", mode: "dry-run", recordedAt: "time" }, payload: { secret: "omit" } }, logs: [{ _id: "a", toolName: "route", status: "success", correlationId: "q", input: { secret: "omit" } }], snapshotStatus: "success" });
    expect(JSON.stringify(evidence)).not.toContain("omit");
    expect(evidence.engineSnapshotStatus).toBe("success");
    expect(evidence.audit).toHaveLength(1);
  });
});
