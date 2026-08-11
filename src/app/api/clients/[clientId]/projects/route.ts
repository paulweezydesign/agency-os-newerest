import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import {
  handleCreateProject,
  handleListProjectsForClient,
} from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

export const GET = async (_request: Request, context: RouteContext) => {
  const { clientId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getProjectService();
  const result = await handleListProjectsForClient({
    session,
    service,
    clientId,
  });
  return NextResponse.json(result.body, { status: result.status });
};

export const POST = async (request: Request, context: RouteContext) => {
  const { clientId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getProjectService();
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleCreateProject({
    session,
    service,
    clientId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
