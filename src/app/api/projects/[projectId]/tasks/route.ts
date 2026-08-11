import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import {
  handleCreateTask,
  handleListTasksForProject,
} from "@/lib/tasks/tasks-api";
import { getTaskService } from "@/lib/tasks/get-task-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const GET = async (_request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getTaskService();
  const result = await handleListTasksForProject({
    session,
    service,
    projectId,
  });
  return NextResponse.json(result.body, { status: result.status });
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getTaskService();
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleCreateTask({
    session,
    service,
    projectId,
    body,
    headers: request.headers,
  });
  return NextResponse.json(result.body, { status: result.status });
};
