import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import type { ProjectService } from "@/lib/projects/project-service";
import type { TaskRepository } from "./task-repository";
import {
  createTaskInputSchema,
  updateTaskInputSchema,
  type CreateTaskInput,
  type Task,
  type UpdateTaskInput,
} from "./schemas";

export class ProjectNotFoundError extends Error {
  constructor(message = "Project not found for tenant") {
    super(message);
    this.name = "ProjectNotFoundError";
  }
}

export class TaskNotFoundError extends Error {
  constructor(message = "Task not found for tenant") {
    super(message);
    this.name = "TaskNotFoundError";
  }
}

export type TaskService = {
  create: (
    input: CreateTaskInput & {
      tenantId: string;
      projectId: string;
      correlationId: string;
      actorName: string;
    },
  ) => Promise<Task>;
  listByProject: (tenantId: string, projectId: string) => Promise<Task[]>;
  get: (tenantId: string, taskId: string) => Promise<Task | null>;
  update: (
    input: UpdateTaskInput & {
      tenantId: string;
      taskId: string;
      correlationId: string;
      actorName: string;
    },
  ) => Promise<Task>;
};

export const createTaskService = (
  repository: TaskRepository,
  projects: Pick<ProjectService, "get">,
  actionLogs: AgentActionLogRepository,
): TaskService => ({
  create: async ({
    tenantId,
    projectId,
    correlationId,
    actorName,
    ...input
  }) => {
    const parsed = createTaskInputSchema.parse(input);
    const project = await projects.get(tenantId, projectId);

    if (!project) {
      throw new ProjectNotFoundError();
    }

    const created = await repository.create({
      tenantId,
      projectId,
      title: parsed.title,
      description: parsed.description ?? "",
      status: "todo",
      assignee: parsed.assignee ?? null,
    });

    await actionLogs.append({
      tenantId,
      agentName: actorName,
      toolName: "tasks.create",
      input: { projectId, ...parsed },
      output: created,
      status: "success",
      correlationId,
      projectId,
      taskId: created.id,
    });

    return created;
  },
  listByProject: (tenantId, projectId) =>
    repository.listByTenantAndProject(tenantId, projectId),
  get: (tenantId, taskId) => repository.getByTenantAndId(tenantId, taskId),
  update: async ({
    tenantId,
    taskId,
    correlationId,
    actorName,
    ...input
  }) => {
    const parsed = updateTaskInputSchema.parse(input);
    const updated = await repository.updateByTenantAndId(
      tenantId,
      taskId,
      parsed,
    );

    if (!updated) {
      throw new TaskNotFoundError();
    }

    await actionLogs.append({
      tenantId,
      agentName: actorName,
      toolName: "tasks.update",
      input: { taskId, ...parsed },
      output: updated,
      status: "success",
      correlationId,
      projectId: updated.projectId,
      taskId: updated.id,
    });

    return updated;
  },
});
