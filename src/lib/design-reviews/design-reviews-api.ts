import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import type { AuthSession } from "@/lib/auth/session-context";
import { ProjectNotFoundError } from "@/lib/projects/project-service";
import type { ProjectService } from "@/lib/projects/project-service";
import {
  DesignReviewNotFoundError,
  DesignReviewStateError,
  type DesignReviewService,
} from "./design-review-service";
import {
  createDesignReviewInputSchema,
  decideDesignReviewInputSchema,
  type DesignReview,
} from "./schemas";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 403 | 404; body: ErrorBody };

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

export const handleCreateDesignReview = async (input: {
  session: AuthSession;
  service: DesignReviewService;
  projectId: string;
  body: unknown;
}): Promise<ApiResult<DesignReview>> => {
  const access = resolveOperatorApiAccess(input.session);
  switch (access.status) {
    case "unauthenticated":
    case "forbidden":
      return toAuthError(access.status);
    case "allow":
      break;
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }

  try {
    const parsed = createDesignReviewInputSchema.parse(input.body);
    const review = await input.service.create({
      tenantId: access.context.tenantId,
      projectId: input.projectId,
      ...parsed,
    });
    return { status: 201, body: review };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    if (error instanceof ProjectNotFoundError) {
      return { status: 404, body: { error: "Project not found" } };
    }
    throw error;
  }
};

export const handleListDesignReviews = async (input: {
  session: AuthSession;
  service: DesignReviewService;
  projects: Pick<ProjectService, "get">;
  projectId: string;
}): Promise<ApiResult<DesignReview[]>> => {
  const operator = resolveOperatorApiAccess(input.session);
  if (operator.status === "allow") {
    const listed = await input.service.listByProject(
      operator.context.tenantId,
      input.projectId,
    );
    return { status: 200, body: listed };
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

  const listed = await input.service.listByProject(
    portal.context.tenantId,
    input.projectId,
  );
  return { status: 200, body: listed };
};

export const handleDecideDesignReview = async (input: {
  session: AuthSession;
  service: DesignReviewService;
  projects: Pick<ProjectService, "get">;
  projectId: string;
  reviewId: string;
  body: unknown;
}): Promise<ApiResult<DesignReview>> => {
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
    const parsed = decideDesignReviewInputSchema.parse(input.body);
    const review = await input.service.decide({
      tenantId: portal.context.tenantId,
      reviewId: input.reviewId,
      decision: parsed.decision,
      annotation: parsed.annotation,
      decidedBy: portal.context.userId,
    });

    if (review.projectId !== input.projectId) {
      return { status: 404, body: { error: "Design review not found" } };
    }

    return { status: 200, body: review };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    if (error instanceof DesignReviewNotFoundError) {
      return { status: 404, body: { error: "Design review not found" } };
    }
    if (error instanceof DesignReviewStateError) {
      return { status: 400, body: { error: error.message } };
    }
    throw error;
  }
};
