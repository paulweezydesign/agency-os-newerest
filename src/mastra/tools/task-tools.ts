import { createTool } from "@mastra/core/tools";
import type { ToolExecutionContext } from "@mastra/core/tools";
import { z } from "zod";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { TaskService } from "@/lib/tasks/task-service";

export const PROJECT_MANAGER_AGENT_NAME = "project-manager";

export const listTasksInputSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

export const createTaskToolInputSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  title: z.string().trim().min(1, "Task title is required"),
  description: z.string().trim().optional(),
});

export type ProjectManagerToolDeps = {
  taskService: TaskService;
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

export const createListTasksTool = ({
  taskService,
  actionLogs,
}: ProjectManagerToolDeps) =>
  createTool({
    id: "listTasks",
    description:
      "List Tasks for a project from the AgencyOS system of record. Use this to inspect work; do not invent task state.",
    inputSchema: listTasksInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);
      const tasks = await taskService.listByProject(tenantId, input.projectId);

      await actionLogs.append({
        tenantId,
        agentName: PROJECT_MANAGER_AGENT_NAME,
        toolName: "listTasks",
        input,
        output: { tasks },
        status: "success",
        correlationId,
        projectId: input.projectId,
      });

      return { tasks };
    },
  });

export const createCreateTaskTool = ({
  taskService,
  actionLogs,
}: ProjectManagerToolDeps) =>
  createTool({
    id: "createTask",
    description:
      "Create a Task in AgencyOS for a project. Orchestration only — never execute deliverable work yourself.",
    inputSchema: createTaskToolInputSchema,
    execute: async (input, context) => {
      const { tenantId, correlationId } = readRequestFields(context);

      try {
        const task = await taskService.create({
          tenantId,
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          correlationId,
          actorName: PROJECT_MANAGER_AGENT_NAME,
        });

        await actionLogs.append({
          tenantId,
          agentName: PROJECT_MANAGER_AGENT_NAME,
          toolName: "createTask",
          input,
          output: { task },
          status: "success",
          correlationId,
          projectId: input.projectId,
          taskId: task.id,
        });

        return { task };
      } catch (error) {
        await actionLogs.append({
          tenantId,
          agentName: PROJECT_MANAGER_AGENT_NAME,
          toolName: "createTask",
          input,
          output: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          status: "error",
          correlationId,
          projectId: input.projectId,
        });
        throw error;
      }
    },
  });

export const createProjectManagerTaskTools = (deps: ProjectManagerToolDeps) => ({
  listTasks: createListTasksTool(deps),
  createTask: createCreateTaskTool(deps),
});
