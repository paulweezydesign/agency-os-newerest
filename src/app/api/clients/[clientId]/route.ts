import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleGetClient } from "@/lib/clients/clients-api";
import { getClientService } from "@/lib/clients/get-client-service";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

export const GET = async (_request: Request, context: RouteContext) => {
  const { clientId } = await context.params;
  const session = toAuthSession(await auth());
  const service = await getClientService();
  const result = await handleGetClient({ session, service, clientId });
  return NextResponse.json(result.body, { status: result.status });
};
