import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import {
  handleCreateClient,
  handleListClients,
} from "@/lib/clients/clients-api";
import { getClientService } from "@/lib/clients/get-client-service";

export const GET = async () => {
  const session = toAuthSession(await auth());
  const service = await getClientService();
  const result = await handleListClients({ session, service });
  return NextResponse.json(result.body, { status: result.status });
};

export const POST = async (request: Request) => {
  const session = toAuthSession(await auth());
  const service = await getClientService();
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleCreateClient({ session, service, body });
  return NextResponse.json(result.body, { status: result.status });
};
