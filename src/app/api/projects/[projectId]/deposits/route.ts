import { getApiSessionAccessError } from "@/lib/auth/api-session-access";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleStartDeposit } from "@/lib/stripe/deposits-api";
import { getDepositService } from "@/lib/stripe/get-deposit-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => null);
  const session = toAuthSession(await auth());
  const accessError = getApiSessionAccessError(session);
  if (accessError) {
    return NextResponse.json(accessError.body, { status: accessError.status });
  }
  const result = await handleStartDeposit({
    session,
    deposits: await getDepositService(),
    projectId,
    body,
  });

  return NextResponse.json(result.body, { status: result.status });
};
