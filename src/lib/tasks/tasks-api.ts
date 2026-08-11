import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import {
  ProjectNotFoundError,
  TaskNotFoundError,
  type TaskService,
} from "./task-service";
import {
  createTaskInputSchema,
  updateTaskInputSchema,
  type Task,
} from "./schemas";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 403 | 404; body: ErrorBody };

type HandlerDeps = {
  session: AuthSession;
  service: TaskService;
};

const toAuthError = (
  status: "unauthenticated" | "forbidden",
): ApiResult<never> => {
  switch (status) {
    case "unauthenticated":
      return { status: 401, body: { error: "Unauthorized" } };
    case "forbidden":
      return { status: 403, body: { error: "Forbidden" } };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

const requireOperator = (session: AuthSession) => {
  const access = resolveOperatorApiAccess(session);

  switch (access.status) {
    case "unauthenticated":
    case "forbidden":
      return { ok: false as const, result: toAuthError(access.status) };
    case "allow":
      return { ok: true as const, context: access.context };
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
};

const readCorrelationId = (headers?: Headers): string => {
  const fromHeader = headers?.get("x-correlation-id")?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
};

export const handleCreateTask = async ({
  session,
  service,
  projectId,
  body,
  headers,
}: HandlerDeps & {
  projectId: string;
  body: unknown;
  headers?: Headers;
}): Promise<ApiResult<Task>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = createTaskInputSchema.parse(body);
    const created = await service.create({
      tenantId: access.context.tenantId,
      projectId,
      correlationId: readCorrelationId(headers),
      actorName: access.context.role,
      ...parsed,
    });

    return { status: 201, body: created };
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return { status: 404, body: { error: "Project not found" } };
    }

    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }

    throw error;
  }
};

export const handleListTasksForProject = async ({
  session,
  service,
  projectId,
}: HandlerDeps & { projectId: string }): Promise<ApiResult<Task[]>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const tasks = await service.listByProject(
    access.context.tenantId,
    projectId,
  );
  return { status: 200, body: tasks };
};

export const handleUpdateTask = async ({
  session,
  service,
  taskId,
  body,
  headers,
}: HandlerDeps & {
  taskId: string;
  body: unknown;
  headers?: Headers;
}): Promise<ApiResult<Task>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = updateTaskInputSchema.parse(body);
    const updated = await service.update({
      tenantId: access.context.tenantId,
      taskId,
      correlationId: readCorrelationId(headers),
      actorName: access.context.role,
      ...parsed,
    });

    return { status: 200, body: updated };
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return { status: 404, body: { error: "Not found" } };
    }

    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }

    throw error;
  }
};
