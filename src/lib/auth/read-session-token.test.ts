import { describe, expect, it } from "vitest";
import { encode, getToken } from "next-auth/jwt";
import { readAuthSessionToken } from "./read-session-token";

const secret = "test-only-secret-not-used-in-any-deployment";
const identity = { id: "github:42", authSource: "github", role: "admin", tenantId: "tenant-default" };

const requestWithToken = async (url: string, cookieName: string) => {
  const token = await encode({ token: identity, secret, salt: cookieName });
  return new Request(url, { headers: { cookie: `${cookieName}=${token}` } });
};

describe("Auth.js middleware JWT cookie lookup", () => {
  it("recognizes secure-prefixed Auth.js session cookies on HTTPS", async () => {
    const request = await requestWithToken("https://example.com/dashboard", "__Secure-authjs.session-token");

    // Reproduces the original bug: getToken's default looks for the non-secure cookie.
    expect(await getToken({ req: request, secret })).toBeNull();
    expect(await readAuthSessionToken(request, secret)).toMatchObject(identity);
  });

  it("recognizes unprefixed Auth.js session cookies on local HTTP", async () => {
    const request = await requestWithToken("http://localhost:3000/dashboard", "authjs.session-token");
    expect(await readAuthSessionToken(request, secret)).toMatchObject(identity);
  });

  it("does not accept an HTTPS session encrypted with an untrusted secret", async () => {
    const request = await requestWithToken("https://example.com/dashboard", "__Secure-authjs.session-token");
    expect(await readAuthSessionToken(request, "different-secret")).toBeNull();
  });
});
