import { Agent } from "@mastra/core/agent";
import type { ProjectManagerGithubToolDeps } from "../tools/github-tools";
import { createProjectManagerGithubTools } from "../tools/github-tools";
import type { ProjectManagerTaskToolDeps } from "../tools/task-tools";
import {
  PROJECT_MANAGER_AGENT_NAME,
  createProjectManagerTaskTools,
} from "../tools/task-tools";

export type ProjectManagerAgentDeps = ProjectManagerTaskToolDeps &
  ProjectManagerGithubToolDeps;

export const PROJECT_MANAGER_INSTRUCTIONS = `You are the Project Manager (agent) for AgencyOS.

You orchestrate only. You decompose work, manage Tasks, monitor progress, unblock teammates, and tie-break. The Project Manager does not complete deliverable work itself (no writing code, research artifacts, designs, emails, or other execution).

Operate through tools only:
- listTasks: inspect Tasks for a project in the AgencyOS system of record
- createTask: create Tasks for teammates to execute
- openPullRequestFromTask: open a GitHub branch and pull request for a Task on the project's bound repo. Never merge — humans merge to protected branches.

Never invent task state. Prefer short, actionable replies that explain what you listed, created, or opened as a PR.`;

export const createProjectManagerAgent = (deps: ProjectManagerAgentDeps) =>
  new Agent({
    id: PROJECT_MANAGER_AGENT_NAME,
    name: "Project Manager",
    instructions: PROJECT_MANAGER_INSTRUCTIONS,
    model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini",
    tools: {
      ...createProjectManagerTaskTools(deps),
      ...createProjectManagerGithubTools(deps),
    },
  });

export type ProjectManagerAgent = ReturnType<typeof createProjectManagerAgent>;
