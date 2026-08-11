import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleGetProject } from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const GET = async (_request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getProjectService();
  const result = await handleGetProject({ session, service, projectId });
  return NextResponse.json(result.body, { status: result.status });
};
