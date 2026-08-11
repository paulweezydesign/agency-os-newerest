import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getArtifactService } from "@/lib/project-artifacts/get-artifact-service";
import {
  handleCreateArtifact,
  handleListArtifacts,
} from "@/lib/project-artifacts/artifacts-api";
import type { ArtifactKind } from "@/lib/project-artifacts/schemas";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const GET = async (_request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getArtifactService();
  const result = await handleListArtifacts({
    session,
    service,
    projectId,
  });
  return Response.json(result.body, { status: result.status });
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getArtifactService();
  const body = (await request.json().catch(() => ({}))) as {
    kind?: ArtifactKind;
    title?: string;
    body?: string;
  };
  const kind = body.kind;
  if (kind !== "brief" && kind !== "sow" && kind !== "mvp_scaffold") {
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  }

  const result = await handleCreateArtifact({
    session,
    service,
    projectId,
    kind,
    body: { title: body.title, body: body.body },
    headers: request.headers,
  });
  return Response.json(result.body, { status: result.status });
};
