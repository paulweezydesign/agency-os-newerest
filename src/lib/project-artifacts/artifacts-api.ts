import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import { ProjectNotFoundError } from "@/lib/projects/project-service";
import {
  ArtifactKindError,
  ArtifactNotFoundError,
  type ArtifactService,
} from "./artifact-service";
import {
  createArtifactInputSchema,
  sendSowInputSchema,
  type ProjectArtifact,
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

const readCorrelationId = (headers?: Headers) => {
  const fromHeader = headers?.get("x-correlation-id")?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
};

export const handleListArtifacts = async ({
  session,
  service,
  projectId,
}: {
  session: AuthSession;
  service: ArtifactService;
  projectId: string;
}): Promise<ApiResult<ProjectArtifact[]>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const artifacts = await service.listByProject(
    access.context.tenantId,
    projectId,
  );
  return { status: 200, body: artifacts };
};

type CreateKind = "brief" | "sow" | "mvp_scaffold";

export const handleCreateArtifact = async ({
  session,
  service,
  projectId,
  kind,
  body,
  headers,
}: {
  session: AuthSession;
  service: ArtifactService;
  projectId: string;
  kind: CreateKind;
  body: unknown;
  headers?: Headers;
}): Promise<ApiResult<ProjectArtifact>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = createArtifactInputSchema.parse(body);
    const correlationId = readCorrelationId(headers);
    const actorName = access.context.role;
    const input = {
      tenantId: access.context.tenantId,
      projectId,
      title: parsed.title,
      body: parsed.body,
      correlationId,
      actorName,
    };

    const artifact = await (async () => {
      switch (kind) {
        case "brief":
          return service.createProjectBrief(input);
        case "sow":
          return service.generateSOW(input);
        case "mvp_scaffold":
          return service.buildMVPScaffold(input);
        default: {
          const _exhaustive: never = kind;
          return _exhaustive;
        }
      }
    })();

    return { status: 201, body: artifact };
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

export const handleSendSow = async ({
  session,
  service,
  projectId,
  body,
  headers,
}: {
  session: AuthSession;
  service: ArtifactService;
  projectId: string;
  body: unknown;
  headers?: Headers;
}): Promise<ApiResult<{ gateId: string; status: "pending" }>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = sendSowInputSchema.parse(body);
    const result = await service.sendSowToClient({
      tenantId: access.context.tenantId,
      projectId,
      artifactId: parsed.artifactId,
      correlationId: readCorrelationId(headers),
      actorName: access.context.role,
    });
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return { status: 404, body: { error: "Project not found" } };
    }
    if (error instanceof ArtifactNotFoundError) {
      return { status: 404, body: { error: "Artifact not found" } };
    }
    if (error instanceof ArtifactKindError) {
      return { status: 400, body: { error: error.message } };
    }
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    throw error;
  }
};
