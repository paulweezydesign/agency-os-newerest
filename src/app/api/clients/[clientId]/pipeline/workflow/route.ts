import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleBetaWorkflow } from "@/lib/client-pipeline/beta-workflow-api";

export const POST = async (
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) => {
  const { clientId } = await context.params;
  const result = await handleBetaWorkflow({
    session: toAuthSession(await auth()),
    clientId,
    body: await request.json().catch(() => null),
  });
  return NextResponse.json(result.body, { status: result.status });
};
