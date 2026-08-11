import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getProjectService } from "@/lib/projects/get-project-service";
import { createUatChecklistInputSchema } from "@/lib/uat/schemas";
import { getUatService } from "@/lib/uat/get-uat-service";

type RouteContext = { params: Promise<{ projectId: string }> };

export const GET = async (_request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const uat = await getUatService();
  const projects = await getProjectService();

  const operator = resolveOperatorApiAccess(session);
  if (operator.status === "allow") {
    const checklist = await uat.getByProject(
      operator.context.tenantId,
      projectId,
    );
    return NextResponse.json(checklist, { status: 200 });
  }

  const portal = resolvePortalAccess(session, findSeedClientIdForUser);
  if (portal.status === "redirect") {
    return NextResponse.json(
      { error: portal.to === "/signin" ? "Unauthorized" : "Forbidden" },
      { status: portal.to === "/signin" ? 401 : 403 },
    );
  }

  const project = await projects.get(portal.context.tenantId, projectId);
  if (!project || project.clientId !== portal.context.clientId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const checklist = await uat.getByProject(portal.context.tenantId, projectId);
  return NextResponse.json(checklist, { status: 200 });
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const access = resolveOperatorApiAccess(session);
  if (access.status !== "allow") {
    return NextResponse.json(
      { error: access.status === "unauthenticated" ? "Unauthorized" : "Forbidden" },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = createUatChecklistInputSchema.parse(body);
    const checklist = await (
      await getUatService()
    ).createChecklist({
      tenantId: access.context.tenantId,
      projectId,
      labels: parsed.labels,
    });
    return NextResponse.json(checklist, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    throw error;
  }
};
