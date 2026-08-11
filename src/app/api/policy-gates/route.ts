import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import {
  handleListPolicyGates,
  handleRequestPolicyGate,
} from "@/lib/policy-gates/policy-gates-api";

export const GET = async (request: Request) => {
  const session = toAuthSession(await auth());
  const service = await getPolicyGateService();
  const url = new URL(request.url);
  const pendingOnly = url.searchParams.get("pendingOnly") !== "false";
  const result = await handleListPolicyGates({
    session,
    service,
    pendingOnly,
  });
  return NextResponse.json(result.body, { status: result.status });
};

export const POST = async (request: Request) => {
  const session = toAuthSession(await auth());
  const service = await getPolicyGateService();
  const body = await request.json().catch(() => ({}));
  const result = await handleRequestPolicyGate({ session, service, body });
  return NextResponse.json(result.body, { status: result.status });
};
