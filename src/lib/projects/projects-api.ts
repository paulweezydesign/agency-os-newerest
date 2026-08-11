import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import {
  ClientNotFoundError,
  ProjectNotFoundError,
  type ProjectService,
  type RecordSpendResult,
} from "./project-service";
import {
  bindGithubRepoInputSchema,
  createProjectInputSchema,
  recordProjectSpendInputSchema,
  type BudgetAlert,
  type Project,
} from "./schemas";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 403 | 404; body: ErrorBody };

type HandlerDeps = {
  session: AuthSession;
  service: ProjectService;
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

export const handleCreateProject = async ({
  session,
  service,
  clientId,
  body,
}: HandlerDeps & {
  clientId: string;
  body: unknown;
}): Promise<ApiResult<Project>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = createProjectInputSchema.parse(body);
    const created = await service.create({
      tenantId: access.context.tenantId,
      clientId,
      ...parsed,
    });

    return { status: 201, body: created };
  } catch (error) {
    if (error instanceof ClientNotFoundError) {
      return { status: 404, body: { error: "Client not found" } };
    }

    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }

    throw error;
  }
};

export const handleListProjectsForClient = async ({
  session,
  service,
  clientId,
}: HandlerDeps & { clientId: string }): Promise<ApiResult<Project[]>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const projects = await service.listByClient(
    access.context.tenantId,
    clientId,
  );
  return { status: 200, body: projects };
};

export const handleGetProject = async ({
  session,
  service,
  projectId,
}: HandlerDeps & { projectId: string }): Promise<ApiResult<Project>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const project = await service.get(access.context.tenantId, projectId);

  if (!project) {
    return { status: 404, body: { error: "Not found" } };
  }

  return { status: 200, body: project };
};

export const handleRecordProjectSpend = async ({
  session,
  service,
  projectId,
  body,
}: HandlerDeps & {
  projectId: string;
  body: unknown;
}): Promise<ApiResult<RecordSpendResult>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = recordProjectSpendInputSchema.parse(body);
    const result = await service.recordSpend({
      tenantId: access.context.tenantId,
      projectId,
      ...parsed,
    });

    return { status: 200, body: result };
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

export const handleListBudgetAlerts = async ({
  session,
  service,
  projectId,
}: HandlerDeps & { projectId: string }): Promise<ApiResult<BudgetAlert[]>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const project = await service.get(access.context.tenantId, projectId);

  if (!project) {
    return { status: 404, body: { error: "Not found" } };
  }

  const alerts = await service.listBudgetAlerts(
    access.context.tenantId,
    projectId,
  );
  return { status: 200, body: alerts };
};

export const handleBindGithubRepo = async ({
  session,
  service,
  projectId,
  body,
}: HandlerDeps & {
  projectId: string;
  body: unknown;
}): Promise<ApiResult<Project>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = bindGithubRepoInputSchema.parse(body);
    const project = await service.bindGithubRepo({
      tenantId: access.context.tenantId,
      projectId,
      ...parsed,
    });

    return { status: 200, body: project };
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
