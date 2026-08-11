import { describe, expect, it } from "vitest";
import {
  createInMemoryGitHubClient,
  type GitHubClient,
} from "./github-client";

describe("createInMemoryGitHubClient", () => {
  it("creates a branch and opens a pull request without a merge method", async () => {
    const github = createInMemoryGitHubClient();

    await github.createBranch({
      repo: "acme/site",
      branch: "agencyos/task-abc",
      fromRef: "main",
    });

    const pullRequest = await github.openPullRequest({
      repo: "acme/site",
      title: "Add login",
      body: "From task",
      head: "agencyos/task-abc",
      base: "main",
    });

    expect(pullRequest).toMatchObject({
      number: 1,
      url: "https://github.com/acme/site/pull/1",
      head: "agencyos/task-abc",
      base: "main",
    });

    const client: GitHubClient = github;
    expect("merge" in client).toBe(false);
    expect("mergePullRequest" in client).toBe(false);
  });

  it("surfaces an actionable error when opening a PR for a missing branch", async () => {
    const github = createInMemoryGitHubClient();

    await expect(
      github.openPullRequest({
        repo: "acme/site",
        title: "Missing branch",
        body: "",
        head: "does-not-exist",
      }),
    ).rejects.toThrow(/branch "does-not-exist" does not exist/i);
  });
});
