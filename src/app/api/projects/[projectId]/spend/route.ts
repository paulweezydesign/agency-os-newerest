import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleRecordProjectSpend } from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getProjectService();
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleRecordProjectSpend({
    session,
    service,
    projectId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
