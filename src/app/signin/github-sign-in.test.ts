import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signIn } from "next-auth/react";
import { startGitHubSignIn } from "./github-sign-in";

vi.mock("next-auth/react", () => ({ signIn: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => vi.clearAllMocks());

describe("GitHub OAuth sign-in navigation", () => {
  it("starts OAuth using the client Auth.js helper with the approved return path", async () => {
    await startGitHubSignIn("/dashboard");
    expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/dashboard" });
  });

  it("keeps GitHub OAuth out of Next.js Server Action form redirects", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).toContain("<GitHubSignInButton redirectTo={destination} />");
    expect(page).not.toMatch(/signIn\(["']github["']/);
  });
});
