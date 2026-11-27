export function validateDockerEndpoint(endpoint) {
  if (!/^unix:\/\/\//.test(endpoint) && !/^npipe:\/\/\/\/\.\/pipe\//.test(endpoint)) throw new Error("Demo requires a local Docker socket or named pipe");
  return endpoint;
}

export function assertLocalContext(parent = process.env) {
  if (parent.NODE_ENV === "production" || ["VERCEL", "VERCEL_ENV", "VERCEL_URL", "NETLIFY", "RENDER", "AWS_LAMBDA_FUNCTION_NAME", "CI"].some(key => Boolean(parent[key]))) throw new Error("Demo requires a local, non-production, non-hosted shell");
}

export function validateDemoMongo(uri) {
  const url = new URL(uri);
  if (url.protocol !== "mongodb:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.search || url.hash || !/^\/agency_demo_test_[a-f0-9]+$/.test(url.pathname)) {
    throw new Error("Demo requires its own loopback synthetic Mongo database");
  }
  return url.pathname.slice(1);
}

export function parseDemoArgs(args) {
  const options = { headed: false, hold: false, noSandbox: false, chromium: undefined };
  for (const arg of args) {
    if (arg === "--headed") options.headed = true;
    else if (arg === "--hold") options.hold = true;
    else if (arg === "--no-sandbox") options.noSandbox = true;
    else if (arg.startsWith("--chromium=") && arg.slice(11)) options.chromium = arg.slice(11);
    else throw new Error(`Unknown demo option: ${arg}`);
  }
  return options;
}

export function demoEnvironment({ uri, port, secret, fontMock, parent = process.env }) {
  assertLocalContext(parent);
  validateDemoMongo(uri);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid local app port");
  return {
    PATH: parent.PATH ?? "",
    ...(parent.SystemRoot ? { SystemRoot: parent.SystemRoot } : {}),
    NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1",
    AGENCYOS_ENABLE_DEMO_AUTH: "true", AGENCYOS_DRY_RUN_WORKFLOW: "true",
    AUTH_URL: `http://127.0.0.1:${port}`, AUTH_TRUST_HOST: "true", AUTH_SECRET: secret,
    MONGODB_URI: uri, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fontMock,
  };
}

export function summarizeEvidence({ client, run, gate, logs, snapshotStatus }) {
  return {
    client: { id: String(client._id), name: client.name, stage: client.pipelineStage, score: client.leadScore },
    run: { id: run.runId, correlationId: run.correlationId, mastraRunId: run.mastraRunId, engineState: run.engineState },
    gate: { id: String(gate._id), status: gate.status, dryRun: gate.dryRun, effectRan: gate.effectRan, receipt: gate.effectReceipt },
    engineSnapshotStatus: snapshotStatus,
    audit: logs.map((log) => ({ id: String(log._id), tool: log.toolName, status: log.status, correlationId: log.correlationId })),
  };
}
