import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getArtifactService } from "@/lib/project-artifacts/get-artifact-service";
import { handleSendSow } from "@/lib/project-artifacts/artifacts-api";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getArtifactService();
  const body = await request.json().catch(() => ({}));
  const result = await handleSendSow({
    session,
    service,
    projectId,
    body,
    headers: request.headers,
  });
  return Response.json(result.body, { status: result.status });
};
