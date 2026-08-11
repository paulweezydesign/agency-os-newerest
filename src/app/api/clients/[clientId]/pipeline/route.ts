import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleRunClientPipeline } from "@/lib/client-pipeline/client-pipeline-api";
import { getClientPipelineService } from "@/lib/client-pipeline/get-client-pipeline-service";
import { toAuthSession } from "@/lib/auth/to-auth-session";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { clientId } = await context.params;
  const body = await request.json().catch(() => null);
  const service = await getClientPipelineService();
  const result = await handleRunClientPipeline({
    session: toAuthSession(await auth()),
    service,
    clientId,
    body,
  });

  return NextResponse.json(result.body, { status: result.status });
};
