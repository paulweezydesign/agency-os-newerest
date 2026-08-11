import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleProjectManagerChat } from "@/lib/agents/project-manager-chat-api";
import { getProjectManagerAgent } from "@/lib/agents/get-project-manager-agent";
import { toAuthSession } from "@/lib/auth/to-auth-session";

type RouteContext = {
  params: Promise<{ name: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { name } = await context.params;

  if (name !== "project-manager") {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const session = toAuthSession(await auth());
  const agent = await getProjectManagerAgent();
  const body: unknown = await request.json().catch(() => ({}));
  const result = await handleProjectManagerChat({
    session,
    body,
    headers: request.headers,
    agent,
  });

  if (result.stream) {
    return new Response(result.stream, {
      status: result.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-correlation-id": result.body.correlationId,
        "x-agent-name": result.body.agentName,
      },
    });
  }

  return NextResponse.json(result.body, { status: result.status });
};
