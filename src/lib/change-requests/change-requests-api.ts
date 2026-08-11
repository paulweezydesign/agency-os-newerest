import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import type { AuthSession } from "@/lib/auth/session-context";
import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import {
  ChangeRequestNotFoundError,
  ChangeRequestStateError,
  type ChangeRequestService,
} from "./change-request-service";
import {
  createChangeRequestInputSchema,
  decideChangeRequestInputSchema,
  type ChangeRequest,
} from "./schemas";

type ErrorBody = { error: string };
export type ApiResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 403 | 404; body: ErrorBody };

export const handleCreateChangeRequest = async (input: {
  session: AuthSession;
  service: ChangeRequestService;
  projects: Pick<ProjectService, "get">;
  projectId: string;
  body: unknown;
}): Promise<ApiResult<ChangeRequest>> => {
  const operator = resolveOperatorApiAccess(input.session);
  if (operator.status === "allow") {
    try {
      const parsed = createChangeRequestInputSchema.parse(input.body);
      const created = await input.service.create({
        tenantId: operator.context.tenantId,
        projectId: input.projectId,
        ...parsed,
        createdBy: operator.context.userId,
        createdByRole: "agency",
      });
      return { status: 201, body: created };
    } catch (error) {
      if (error instanceof ZodError) {
        return { status: 400, body: { error: "Invalid request" } };
      }
      if (error instanceof ProjectNotFoundError) {
        return { status: 404, body: { error: "Project not found" } };
      }
      throw error;
    }
  }

  const portal = resolvePortalAccess(input.session, findSeedClientIdForUser);
  if (portal.status === "redirect") {
    return portal.to === "/signin"
      ? { status: 401, body: { error: "Unauthorized" } }
      : { status: 403, body: { error: "Forbidden" } };
  }

  const project = await input.projects.get(
    portal.context.tenantId,
    input.projectId,
  );
  if (!project || project.clientId !== portal.context.clientId) {
    return { status: 404, body: { error: "Project not found" } };
  }

  try {
    const parsed = createChangeRequestInputSchema.parse(input.body);
    const created = await input.service.create({
      tenantId: portal.context.tenantId,
      projectId: input.projectId,
      ...parsed,
      createdBy: portal.context.userId,
      createdByRole: "client",
    });
    return { status: 201, body: created };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    throw error;
  }
};

export const handleDecideChangeRequest = async (input: {
  session: AuthSession;
  service: ChangeRequestService;
  projects: Pick<ProjectService, "get">;
  projectId: string;
  changeRequestId: string;
  body: unknown;
}): Promise<ApiResult<ChangeRequest>> => {
  try {
    const parsed = decideChangeRequestInputSchema.parse(input.body);

    const operator = resolveOperatorApiAccess(input.session);
    if (operator.status === "allow") {
      const decided = await input.service.decide({
        tenantId: operator.context.tenantId,
        changeRequestId: input.changeRequestId,
        decision: parsed.decision,
        actorId: operator.context.userId,
        actorRole: "agency",
      });
      if (decided.projectId !== input.projectId) {
        return { status: 404, body: { error: "Change request not found" } };
      }
      return { status: 200, body: decided };
    }

    const portal = resolvePortalAccess(input.session, findSeedClientIdForUser);
    if (portal.status === "redirect") {
      return portal.to === "/signin"
        ? { status: 401, body: { error: "Unauthorized" } }
        : { status: 403, body: { error: "Forbidden" } };
    }

    const project = await input.projects.get(
      portal.context.tenantId,
      input.projectId,
    );
    if (!project || project.clientId !== portal.context.clientId) {
      return { status: 404, body: { error: "Project not found" } };
    }

    const decided = await input.service.decide({
      tenantId: portal.context.tenantId,
      changeRequestId: input.changeRequestId,
      decision: parsed.decision,
      actorId: portal.context.userId,
      actorRole: "client",
    });
    return { status: 200, body: decided };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    if (error instanceof ChangeRequestNotFoundError) {
      return { status: 404, body: { error: "Change request not found" } };
    }
    if (error instanceof ChangeRequestStateError) {
      return { status: 400, body: { error: error.message } };
    }
    throw error;
  }
};
