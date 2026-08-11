import { describe, expect, it } from "vitest";
import { RequestContext } from "@mastra/core/request-context";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryGitHubClient } from "@/lib/github/github-client";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import {
  createOpenPullRequestFromTaskTool,
  openPullRequestFromTaskInputSchema,
} from "./github-tools";
import { PROJECT_MANAGER_AGENT_NAME } from "./task-tools";

const createDeps = async (bindGithub = true) => {
  const clients = createClientService(createInMemoryClientRepository());
  const projectService = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const actionLogs = createInMemoryAgentActionLogRepository();
  const taskService = createTaskService(
    createInMemoryTaskRepository(),
    projectService,
    actionLogs,
  );
  const github = createInMemoryGitHubClient();
  const client = await clients.create({
    tenantId: "tenant-default",
    name: "Acme Co",
  });
  const project = await projectService.create({
    tenantId: "tenant-default",
    clientId: client.id,
    name: "Website redesign",
    budget: 10000,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-12-01",
  });

  if (bindGithub) {
    await projectService.bindGithubRepo({
      tenantId: "tenant-default",
      projectId: project.id,
      githubRepo: "acme/website",
    });
  }

  const task = await taskService.create({
    tenantId: "tenant-default",
    projectId: project.id,
    title: "Scaffold auth",
    correlationId: "corr-task",
    actorName: "operator",
  });

  return { taskService, projectService, github, actionLogs, task };
};

const withContext = (tenantId: string, correlationId: string) => {
  const requestContext = new RequestContext();
  requestContext.set("tenantId", tenantId);
  requestContext.set("correlationId", correlationId);
  return { requestContext } as never;
};

describe("openPullRequestFromTask tool", () => {
  it("rejects empty taskId", () => {
    expect(() =>
      openPullRequestFromTaskInputSchema.parse({ taskId: "" }),
    ).toThrow();
  });

  it("opens a PR and logs success", async () => {
    const { taskService, projectService, github, actionLogs, task } =
      await createDeps(true);
    const tool = createOpenPullRequestFromTaskTool({
      taskService,
      projectService,
      github,
      actionLogs,
    });

    const result = (await tool.execute!(
      { taskId: task.id },
      withContext("tenant-default", "corr-pr"),
    )) as {
      repo: string;
      taskId: string;
      pullRequest: { url: string };
    };

    expect(result).toMatchObject({
      repo: "acme/website",
      taskId: task.id,
      pullRequest: {
        url: expect.stringContaining("github.com/acme/website/pull/"),
      },
    });
    const logs = await actionLogs.listByCorrelationId(
      "tenant-default",
      "corr-pr",
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      agentName: PROJECT_MANAGER_AGENT_NAME,
      toolName: "openPullRequestFromTask",
      status: "success",
    });
  });

  it("logs actionable errors when the project has no GitHub binding", async () => {
    const { taskService, projectService, github, actionLogs, task } =
      await createDeps(false);
    const tool = createOpenPullRequestFromTaskTool({
      taskService,
      projectService,
      github,
      actionLogs,
    });

    await expect(
      tool.execute!(
        { taskId: task.id },
        withContext("tenant-default", "corr-fail"),
      ),
    ).rejects.toThrow(/not bound to a GitHub repo/i);

    const logs = await actionLogs.listByCorrelationId(
      "tenant-default",
      "corr-fail",
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("error");
  });
});
