import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getProjectService } from "@/lib/projects/get-project-service";
import { getUatService } from "@/lib/uat/get-uat-service";
import { UatStateError } from "@/lib/uat/uat-service";

type RouteContext = { params: Promise<{ projectId: string }> };

export const POST = async (_request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const session = toAuthSession(await auth());
  const portal = resolvePortalAccess(session, findSeedClientIdForUser);
  if (portal.status === "redirect") {
    return NextResponse.json(
      { error: portal.to === "/signin" ? "Unauthorized" : "Forbidden" },
      { status: portal.to === "/signin" ? 401 : 403 },
    );
  }

  const project = await (
    await getProjectService()
  ).get(portal.context.tenantId, projectId);
  if (!project || project.clientId !== portal.context.clientId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const checklist = await (
      await getUatService()
    ).signOff({
      tenantId: portal.context.tenantId,
      projectId,
      actorId: portal.context.userId,
    });
    return NextResponse.json(checklist, { status: 200 });
  } catch (error) {
    if (error instanceof UatStateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
};
