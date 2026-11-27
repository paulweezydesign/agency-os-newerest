import { getApiSessionAccessError } from "@/lib/auth/api-session-access";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleCreateChangeRequest } from "@/lib/change-requests/change-requests-api";
import { getChangeRequestService } from "@/lib/change-requests/get-change-request-service";
import { getProjectService } from "@/lib/projects/get-project-service";

type RouteContext = { params: Promise<{ projectId: string }> };

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => null);
  const session = toAuthSession(await auth());
  const accessError = getApiSessionAccessError(session, "operator-or-portal");
  if (accessError) {
    return NextResponse.json(accessError.body, { status: accessError.status });
  }
  const result = await handleCreateChangeRequest({
    session,
    service: await getChangeRequestService(),
    projects: await getProjectService(),
    projectId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
