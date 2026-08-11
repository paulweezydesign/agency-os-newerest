import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleUpdateTask } from "@/lib/tasks/tasks-api";
import { getTaskService } from "@/lib/tasks/get-task-service";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export const PATCH = async (request: Request, context: RouteContext) => {
  const { taskId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getTaskService();
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleUpdateTask({
    session,
    service,
    taskId,
    body,
    headers: request.headers,
  });
  return NextResponse.json(result.body, { status: result.status });
};
