import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProjectManagerAgent } from "@/lib/agents/get-project-manager-agent";
import { getSpawnedTeammateAgent } from "@/lib/agents/get-spawned-teammate-agent";
import { getTeammateAgent } from "@/lib/agents/get-teammate-agent";
import { handleProjectManagerChat } from "@/lib/agents/project-manager-chat-api";
import { isSeedTeammateRole } from "@/lib/agents/seed-roster";
import { handleTeammateChat } from "@/lib/agents/teammate-chat-api";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { PROJECT_MANAGER_AGENT_NAME } from "@/mastra/tools/task-tools";

type RouteContext = {
  params: Promise<{ name: string }>;
};

const respond = (
  result: Awaited<ReturnType<typeof handleTeammateChat>>,
) => {
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

export const POST = async (request: Request, context: RouteContext) => {
  const { name } = await context.params;
  const session = toAuthSession(await auth());
  const body: unknown = await request.json().catch(() => ({}));

  if (name === PROJECT_MANAGER_AGENT_NAME) {
    const agent = await getProjectManagerAgent();
    const result = await handleProjectManagerChat({
      session,
      body,
      headers: request.headers,
      agent,
    });
    return respond(result);
  }

  if (isSeedTeammateRole(name)) {
    const agent = await getTeammateAgent(name);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await handleTeammateChat({
      session,
      body,
      headers: request.headers,
      agent,
      agentName: name,
    });
    return respond(result);
  }

  if (name.startsWith("spawned:")) {
    const access = resolveOperatorApiAccess(session);
    if (access.status === "unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (access.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agent = await getSpawnedTeammateAgent(access.context.tenantId, name);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await handleTeammateChat({
      session,
      body,
      headers: request.headers,
      agent,
      agentName: name,
    });
    return respond(result);
  }

  return NextResponse.json({ error: "Agent not found" }, { status: 404 });
};
