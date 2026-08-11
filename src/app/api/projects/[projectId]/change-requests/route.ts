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
  const result = await handleCreateChangeRequest({
    session: toAuthSession(await auth()),
    service: await getChangeRequestService(),
    projects: await getProjectService(),
    projectId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
