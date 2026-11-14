import { getApiSessionAccessError } from "@/lib/auth/api-session-access";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import { handleDecidePolicyGate } from "@/lib/policy-gates/policy-gates-api";

type RouteContext = {
  params: Promise<{ gateId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const session = toAuthSession(await auth());
  const accessError = getApiSessionAccessError(session);
  if (accessError) {
    return NextResponse.json(accessError.body, { status: accessError.status });
  }
  const service = await getPolicyGateService();
  const { gateId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const result = await handleDecidePolicyGate({
    session,
    service,
    gateId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
