/** Shared server-side opt-in predicate; never inferred from a public browser flag. */
export const isBetaWorkflowEnabled = (
  env: { AGENCYOS_BETA_WORKFLOW?: string; VERCEL_ENV?: string } = {
    AGENCYOS_BETA_WORKFLOW: process.env.AGENCYOS_BETA_WORKFLOW,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
) =>
  env.AGENCYOS_BETA_WORKFLOW === "dry-run" && env.VERCEL_ENV !== "production";
