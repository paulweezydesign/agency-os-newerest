import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleAgentRunRequest } from "@/lib/agent-runs/agent-runs-api";

type RouteContext = { params: Promise<{ projectId: string }> };
export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const result = await handleAgentRunRequest({
    session: toAuthSession(await auth()), projectId, method: "POST",
    body: await request.json().catch(() => null),
  });
  return NextResponse.json(result.body, { status: result.status });
};
export const GET = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const result = await handleAgentRunRequest({
    session: toAuthSession(await auth()), projectId, method: "GET",
    body: { runId: new URL(request.url).searchParams.get("runId") },
  });
  return NextResponse.json(result.body, { status: result.status });
};
