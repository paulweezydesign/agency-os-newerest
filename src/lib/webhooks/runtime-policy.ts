/**
 * Current webhook adapters are synthetic fixtures, not provider authentication.
 * Never expose them in production or any Vercel deployment. Development/test
 * hosts must remain loopback-only with an isolated synthetic database; NODE_ENV
 * is a server configuration boundary, not network authentication.
 */
export const areSyntheticWebhooksAllowed = (
  env: NodeJS.ProcessEnv = process.env,
): boolean =>
  (env.NODE_ENV === "development" || env.NODE_ENV === "test") &&
  !env.VERCEL && !env.VERCEL_ENV;
