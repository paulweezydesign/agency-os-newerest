export type GitHubPullRequest = {
  number: number;
  url: string;
  head: string;
  base: string;
  title: string;
};

export type GitHubClient = {
  createBranch: (input: {
    repo: string;
    branch: string;
    fromRef?: string;
  }) => Promise<{ repo: string; branch: string }>;
  openPullRequest: (input: {
    repo: string;
    title: string;
    body: string;
    head: string;
    base?: string;
  }) => Promise<GitHubPullRequest>;
};

export class GitHubClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubClientError";
  }
}

export const createInMemoryGitHubClient = (): GitHubClient & {
  branches: Set<string>;
  pullRequests: GitHubPullRequest[];
} => {
  const branches = new Set<string>();
  const pullRequests: GitHubPullRequest[] = [];
  let prSeq = 0;

  return {
    branches,
    pullRequests,
    createBranch: async ({ repo, branch, fromRef = "main" }) => {
      if (!repo.includes("/")) {
        throw new GitHubClientError(
          `Invalid GitHub repo binding "${repo}". Expected owner/name.`,
        );
      }

      const key = `${repo}:${branch}`;
      if (branches.has(key)) {
        throw new GitHubClientError(
          `Branch "${branch}" already exists on ${repo} (from ${fromRef}).`,
        );
      }

      branches.add(key);
      return { repo, branch };
    },
    openPullRequest: async ({
      repo,
      title,
      body,
      head,
      base = "main",
    }) => {
      if (!repo.includes("/")) {
        throw new GitHubClientError(
          `Invalid GitHub repo binding "${repo}". Expected owner/name.`,
        );
      }

      const branchKey = `${repo}:${head}`;
      if (!branches.has(branchKey)) {
        throw new GitHubClientError(
          `Cannot open PR: branch "${head}" does not exist on ${repo}.`,
        );
      }

      prSeq += 1;
      const pullRequest: GitHubPullRequest = {
        number: prSeq,
        url: `https://github.com/${repo}/pull/${prSeq}`,
        head,
        base,
        title,
      };
      pullRequests.push(pullRequest);
      void body;
      return pullRequest;
    },
  };
};
