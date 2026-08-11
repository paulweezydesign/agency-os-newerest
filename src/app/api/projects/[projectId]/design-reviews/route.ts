import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import {
  handleCreateDesignReview,
  handleListDesignReviews,
} from "@/lib/design-reviews/design-reviews-api";
import { getDesignReviewService } from "@/lib/design-reviews/get-design-review-service";
import { getProjectService } from "@/lib/projects/get-project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export const GET = async (_request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const result = await handleListDesignReviews({
    session: toAuthSession(await auth()),
    service: await getDesignReviewService(),
    projects: await getProjectService(),
    projectId,
  });
  return NextResponse.json(result.body, { status: result.status });
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await handleCreateDesignReview({
    session: toAuthSession(await auth()),
    service: await getDesignReviewService(),
    projectId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
