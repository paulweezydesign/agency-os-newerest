import { getToken } from "next-auth/jwt";

/**
 * Auth.js issues "__Secure-authjs.session-token" on HTTPS, but getToken's
 * default cookie name is the unprefixed "authjs.session-token".
 * Match the HTTPS cookie name (and JWT decoding salt) during protected
 * page checks so valid operators are not redirected to sign-in.
 */
export const readAuthSessionToken = (request: Request, secret?: string) =>
  getToken({
    req: request,
    secret,
    secureCookie: new URL(request.url).protocol === "https:",
  });
