import { createTool } from "@mastra/core/tools";
import type { ToolExecutionContext } from "@mastra/core/tools";
import { z } from "zod";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { GitHubClient } from "@/lib/github/github-client";
import { openPullRequestFromTask } from "@/lib/github/open-pr-from-task";
import type { ProjectService } from "@/lib/projects/project-service";
import type { TaskService } from "@/lib/tasks/task-service";
import { PROJECT_MANAGER_AGENT_NAME } from "./task-tools";

export const openPullRequestFromTaskInputSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
});

export type ProjectManagerGithubToolDeps = {
  taskService: TaskService;
  projectService: ProjectService;
  github: GitHubClient;
  actionLogs: AgentActionLogRepository;
};

type ToolRequestFields = {
  tenantId: string;
  correlationId: string;
};

const readRequestFields = (
  context?: ToolExecutionContext,
): ToolRequestFields => {
  const requestContext = context?.requestContext;
  const tenantId = requestContext?.get("tenantId");
  const correlationId = requestContext?.get("correlationId");

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("requestContext.tenantId is required");
  }

  if (typeof correlationId !== "string" || correlationId.length === 0) {
    throw new Error("requestContext.correlationId is required");
  }

  return { tenantId, correlationId };
};

export const createOpenPullRequestFromTaskTool = ({
  taskService,
  projectService,
  github,
  actionLogs,
}: ProjectManagerGithubToolDeps) =>
  createTool({
    id: "openPullRequestFromTask",
    description:
      "Open a GitHub branch and pull request for a Task on the Project's bound repo. Never merges — humans merge (ADR-0004).",
    inputSchema: openPullRequestFromTaskInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);

      try {
        const result = await openPullRequestFromTask({
          tenantId,
          taskId: input.taskId,
          projects: projectService,
          tasks: taskService,
          github,
        });

        await actionLogs.append({
          tenantId,
          agentName: PROJECT_MANAGER_AGENT_NAME,
          toolName: "openPullRequestFromTask",
          input,
          output: result,
          status: "success",
          correlationId,
          projectId: result.projectId,
          taskId: result.taskId,
        });

        return result;
      } catch (error) {
        await actionLogs.append({
          tenantId,
          agentName: PROJECT_MANAGER_AGENT_NAME,
          toolName: "openPullRequestFromTask",
          input,
          output: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          status: "error",
          correlationId,
          taskId: input.taskId,
        });
        throw error;
      }
    },
  });

export const createProjectManagerGithubTools = (
  deps: ProjectManagerGithubToolDeps,
) => ({
  openPullRequestFromTask: createOpenPullRequestFromTaskTool(deps),
});
