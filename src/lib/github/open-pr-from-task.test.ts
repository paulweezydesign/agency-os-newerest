import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import { createInMemoryGitHubClient } from "./github-client";
import { openPullRequestFromTask } from "./open-pr-from-task";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const actionLogs = createInMemoryAgentActionLogRepository();
  const tasks = createTaskService(
    createInMemoryTaskRepository(),
    projects,
    actionLogs,
  );
  const github = createInMemoryGitHubClient();
  const client = await clients.create({
    tenantId: "tenant-a",
    name: "Acme",
  });
  const project = await projects.create({
    tenantId: "tenant-a",
    clientId: client.id,
    name: "Site",
    budget: 1000,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-10-01",
  });
  const task = await tasks.create({
    tenantId: "tenant-a",
    projectId: project.id,
    title: "Add login page",
    correlationId: "corr-setup",
    actorName: "operator",
  });

  return { projects, tasks, github, project, task };
};

describe("openPullRequestFromTask", () => {
  it("creates a branch and opens a PR on the bound repo", async () => {
    const { projects, tasks, github, project, task } = await setup();
    await projects.bindGithubRepo({
      tenantId: "tenant-a",
      projectId: project.id,
      githubRepo: "acme/site",
    });

    const result = await openPullRequestFromTask({
      tenantId: "tenant-a",
      taskId: task.id,
      projects,
      tasks,
      github,
    });

    expect(result.pullRequest.url).toBe("https://github.com/acme/site/pull/1");
    expect(result.branch).toMatch(/^agencyos\/task-/);
    expect(github.pullRequests).toHaveLength(1);
  });

  it("fails with an actionable error when the project has no GitHub binding", async () => {
    const { projects, tasks, github, task } = await setup();

    await expect(
      openPullRequestFromTask({
        tenantId: "tenant-a",
        taskId: task.id,
        projects,
        tasks,
        github,
      }),
    ).rejects.toThrow(/not bound to a GitHub repo/i);
  });
});
