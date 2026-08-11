import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryGitHubClient } from "@/lib/github/github-client";
import { createSpawnService } from "@/lib/agents/spawn-service";
import { createInMemorySpawnedAgentRepository } from "@/lib/agents/spawned-agent-repository";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import {
  PROJECT_MANAGER_INSTRUCTIONS,
  createProjectManagerAgent,
} from "./project-manager";

const createAgentDeps = (withSpawn = false) => {
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

  return {
    taskService,
    actionLogs,
    projectService,
    github: createInMemoryGitHubClient(),
    ...(withSpawn
      ? {
          spawnService: createSpawnService(
            createInMemorySpawnedAgentRepository(),
            projectService,
            actionLogs,
          ),
        }
      : {}),
  };
};

describe("project-manager agent", () => {
  it("instructions enforce orchestrate-only (no deliverable execution)", () => {
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(/orchestrat/i);
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(
      /does not complete deliverable work/i,
    );
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(
      /listTasks|createTask|openPullRequestFromTask|spawnTeammate/,
    );
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(/tools only|through tools/i);
    expect(PROJECT_MANAGER_INSTRUCTIONS).toMatch(/never merge/i);
  });

  it("exposes task, GitHub, and spawn tools when spawn deps are provided", async () => {
    const agent = createProjectManagerAgent(createAgentDeps(true));
    const tools = await agent.listTools();

    expect(agent.id).toBe("project-manager");
    expect(Object.keys(tools).sort()).toEqual([
      "createTask",
      "listTasks",
      "openPullRequestFromTask",
      "spawnTeammate",
    ]);
  });
});
