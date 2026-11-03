import { expect, it } from "vitest";
import { isBetaWorkflowEnabled } from "./beta-workflow-enabled";
it.each([
  [{}, false],
  [{ AGENCYOS_BETA_WORKFLOW: "dry-run", VERCEL_ENV: "preview" }, true],
  [{ AGENCYOS_BETA_WORKFLOW: "dry-run" }, true],
  [{ AGENCYOS_BETA_WORKFLOW: "dry-run", VERCEL_ENV: "production" }, false],
  [{ AGENCYOS_BETA_WORKFLOW: "live", VERCEL_ENV: "preview" }, false],
])("uses the server opt-in and excludes production: %j", (env, expected) => {
  expect(isBetaWorkflowEnabled(env)).toBe(expected);
});
