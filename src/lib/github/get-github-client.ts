import { createInMemoryGitHubClient, type GitHubClient } from "./github-client";

let shared: GitHubClient | null = null;

/**
 * v1 default: in-memory GitHub client (mocked for tests / local).
 * A thin Octokit adapter can replace this behind the same GitHubClient interface.
 */
export const getGitHubClient = (): GitHubClient => {
  shared ??= createInMemoryGitHubClient();
  return shared;
};

export const resetGitHubClientForTests = (): void => {
  shared = null;
};
