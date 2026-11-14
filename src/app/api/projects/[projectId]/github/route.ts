import { getApiSessionAccessError } from "@/lib/auth/api-session-access";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getProjectService } from "@/lib/projects/get-project-service";
import { handleBindGithubRepo } from "@/lib/projects/projects-api";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const accessError = getApiSessionAccessError(session);
  if (accessError) {
    return Response.json(accessError.body, { status: accessError.status });
  }
  const service = await getProjectService();
  const body = await request.json().catch(() => ({}));
  const result = await handleBindGithubRepo({
    session,
    service,
    projectId,
    body,
  });

  return Response.json(result.body, { status: result.status });
};
