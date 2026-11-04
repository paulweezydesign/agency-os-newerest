import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleReadWorkflow, handleRunWorkflow, isWorkflowEnabled } from "@/lib/client-pipeline/workflow-api";
import { executeClientPipelineWorkflow, getClientPipelineWorkflowRun } from "@/lib/client-pipeline/workflow-service";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ clientId: string }> };

export const POST = async (request: Request, context: RouteContext) => {
  const { clientId } = await context.params;
  const result = await handleRunWorkflow({
    session: toAuthSession(await auth()), enabled: isWorkflowEnabled(), clientId,
    body: await request.json().catch(() => null), execute: executeClientPipelineWorkflow,
  });
  return NextResponse.json(result.body, { status: result.status });
};

export const GET = async (request: Request, context: RouteContext) => {
  const { clientId } = await context.params;
  const result = await handleReadWorkflow({
    session: toAuthSession(await auth()), enabled: isWorkflowEnabled(), clientId,
    runId: new URL(request.url).searchParams.get("runId") ?? "", read: getClientPipelineWorkflowRun,
  });
  return NextResponse.json(result.body, { status: result.status });
};
