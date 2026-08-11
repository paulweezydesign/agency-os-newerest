import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import {
  TaskNotFoundError,
  type TaskService,
} from "@/lib/tasks/task-service";
import type { GitHubClient, GitHubPullRequest } from "./github-client";
import { GitHubClientError } from "./github-client";

export class GithubRepoNotBoundError extends Error {
  constructor(message = "Project is not bound to a GitHub repo") {
    super(message);
    this.name = "GithubRepoNotBoundError";
  }
}

export type OpenPullRequestFromTaskResult = {
  branch: string;
  pullRequest: GitHubPullRequest;
  repo: string;
  taskId: string;
  projectId: string;
};

export const openPullRequestFromTask = async ({
  tenantId,
  taskId,
  projects,
  tasks,
  github,
}: {
  tenantId: string;
  taskId: string;
  projects: Pick<ProjectService, "get">;
  tasks: Pick<TaskService, "get">;
  github: GitHubClient;
}): Promise<OpenPullRequestFromTaskResult> => {
  const task = await tasks.get(tenantId, taskId);

  if (!task) {
    throw new TaskNotFoundError();
  }

  const project = await projects.get(tenantId, task.projectId);

  if (!project) {
    throw new ProjectNotFoundError();
  }

  if (!project.githubRepo) {
    throw new GithubRepoNotBoundError(
      `Project "${project.name}" is not bound to a GitHub repo. Bind owner/name first.`,
    );
  }

  const branch = `agencyos/task-${task.id.slice(0, 8)}`;

  try {
    await github.createBranch({
      repo: project.githubRepo,
      branch,
      fromRef: "main",
    });

    const pullRequest = await github.openPullRequest({
      repo: project.githubRepo,
      title: task.title,
      body: [
        `Opened from AgencyOS task ${task.id}.`,
        task.description ? `\n${task.description}` : "",
        "\n\nMerging remains human-owned (ADR-0004).",
      ].join(""),
      head: branch,
      base: "main",
    });

    return {
      branch,
      pullRequest,
      repo: project.githubRepo,
      taskId: task.id,
      projectId: project.id,
    };
  } catch (error) {
    if (
      error instanceof GitHubClientError ||
      error instanceof GithubRepoNotBoundError ||
      error instanceof TaskNotFoundError ||
      error instanceof ProjectNotFoundError
    ) {
      throw error;
    }

    throw new GitHubClientError(
      error instanceof Error
        ? error.message
        : "Failed to open GitHub pull request",
    );
  }
};
