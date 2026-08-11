import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleDecideChangeRequest } from "@/lib/change-requests/change-requests-api";
import { getChangeRequestService } from "@/lib/change-requests/get-change-request-service";
import { getProjectService } from "@/lib/projects/get-project-service";

type RouteContext = {
  params: Promise<{ projectId: string; changeRequestId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId, changeRequestId } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await handleDecideChangeRequest({
    session: toAuthSession(await auth()),
    service: await getChangeRequestService(),
    projects: await getProjectService(),
    projectId,
    changeRequestId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
