import type { AuthSession } from "@/lib/auth/session-context";
import {
  findSeedClientIdForUser,
} from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import type { ClientService } from "@/lib/clients/client-service";
import type { ProjectArtifact } from "@/lib/project-artifacts/schemas";
import type { ArtifactService } from "@/lib/project-artifacts/artifact-service";
import type { Project } from "@/lib/projects/schemas";
import type { ProjectService } from "@/lib/projects/project-service";
import { ensureSeedPortalClient } from "./ensure-seed-client";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200; body: T }
  | { status: 401 | 403 | 404; body: ErrorBody };

const toPortalAuthError = (
  status: "redirect",
  to: string,
): ApiResult<never> => {
  if (to === "/signin") {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  return { status: 403, body: { error: "Forbidden" } };
};

export const handleListPortalProjects = async (input: {
  session: AuthSession;
  clients: ClientService;
  projects: ProjectService;
}): Promise<ApiResult<Project[]>> => {
  await ensureSeedPortalClient(input.clients);
  const access = resolvePortalAccess(
    input.session,
    findSeedClientIdForUser,
  );

  if (access.status === "redirect") {
    return toPortalAuthError(access.status, access.to);
  }

  const listed = await input.projects.listByClient(
    access.context.tenantId,
    access.context.clientId,
  );
  return { status: 200, body: listed };
};

export const handleGetPortalProject = async (input: {
  session: AuthSession;
  clients: ClientService;
  projects: ProjectService;
  artifacts: Pick<ArtifactService, "listByProject">;
  projectId: string;
}): Promise<
  ApiResult<{ project: Project; artifacts: ProjectArtifact[] }>
> => {
  await ensureSeedPortalClient(input.clients);
  const access = resolvePortalAccess(
    input.session,
    findSeedClientIdForUser,
  );

  if (access.status === "redirect") {
    return toPortalAuthError(access.status, access.to);
  }

  const project = await input.projects.get(
    access.context.tenantId,
    input.projectId,
  );

  if (!project || project.clientId !== access.context.clientId) {
    return { status: 404, body: { error: "Project not found" } };
  }

  const artifacts = await input.artifacts.listByProject(
    access.context.tenantId,
    project.id,
  );

  return { status: 200, body: { project, artifacts } };
};
