import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleDecideDesignReview } from "@/lib/design-reviews/design-reviews-api";
import { getDesignReviewService } from "@/lib/design-reviews/get-design-review-service";
import { getProjectService } from "@/lib/projects/get-project-service";

type RouteContext = {
  params: Promise<{ projectId: string; reviewId: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const { projectId, reviewId } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await handleDecideDesignReview({
    session: toAuthSession(await auth()),
    service: await getDesignReviewService(),
    projects: await getProjectService(),
    projectId,
    reviewId,
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
};
