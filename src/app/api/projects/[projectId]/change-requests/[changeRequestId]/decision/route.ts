import { decideChangeRequestInputSchema } from "@/lib/change-requests/schemas";
import { getApiSessionAccessError } from "@/lib/auth/api-session-access";
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
  const session = toAuthSession(await auth());
  const accessError = getApiSessionAccessError(session, "operator-or-portal");
  if (accessError) {
    // This handler historically validates the decision before checking access.
    if (!decideChangeRequestInputSchema.safeParse(body).success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json(accessError.body, { status: accessError.status });
  }
  const result = await handleDecideChangeRequest({
    session,
    service: await getChangeRequestService(),
    projects: await getProjectService(),
    projectId,
    changeRequestId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
