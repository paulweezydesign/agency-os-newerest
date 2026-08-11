import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import type { DesignReviewRepository } from "./design-review-repository";
import {
  annotateDesignReviewInputSchema,
  createDesignReviewInputSchema,
  decideDesignReviewInputSchema,
  type DesignReview,
} from "./schemas";

export class DesignReviewNotFoundError extends Error {
  constructor(message = "Design review not found") {
    super(message);
    this.name = "DesignReviewNotFoundError";
  }
}

export class DesignReviewStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignReviewStateError";
  }
}

export type DesignReviewService = {
  create: (input: {
    tenantId: string;
    projectId: string;
    title: string;
    assetUrl: string;
    notes?: string;
  }) => Promise<DesignReview>;
  listByProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<DesignReview[]>;
  annotate: (input: {
    tenantId: string;
    reviewId: string;
    annotation: string;
  }) => Promise<DesignReview>;
  decide: (input: {
    tenantId: string;
    reviewId: string;
    decision: "approve" | "reject";
    annotation?: string;
    decidedBy: string;
  }) => Promise<DesignReview>;
};

export const createDesignReviewService = (deps: {
  reviews: DesignReviewRepository;
  projects: Pick<ProjectService, "get">;
}): DesignReviewService => ({
  create: async ({ tenantId, projectId, ...input }) => {
    const parsed = createDesignReviewInputSchema.parse(input);
    const project = await deps.projects.get(tenantId, projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return deps.reviews.create({
      tenantId,
      projectId,
      title: parsed.title,
      assetUrl: parsed.assetUrl,
      notes: parsed.notes,
    });
  },
  listByProject: (tenantId, projectId) =>
    deps.reviews.listByProject(tenantId, projectId),
  annotate: async ({ tenantId, reviewId, annotation }) => {
    const parsed = annotateDesignReviewInputSchema.parse({ annotation });
    const existing = await deps.reviews.getByTenantAndId(tenantId, reviewId);
    if (!existing) {
      throw new DesignReviewNotFoundError();
    }
    if (existing.status === "approved" || existing.status === "rejected") {
      throw new DesignReviewStateError(
        `Cannot annotate a ${existing.status} review`,
      );
    }

    const updated = await deps.reviews.update(tenantId, reviewId, {
      status: "annotated",
      annotation: parsed.annotation,
    });
    if (!updated) {
      throw new DesignReviewNotFoundError();
    }
    return updated;
  },
  decide: async ({ tenantId, reviewId, decision, annotation, decidedBy }) => {
    const parsed = decideDesignReviewInputSchema.parse({
      decision,
      annotation,
    });
    const existing = await deps.reviews.getByTenantAndId(tenantId, reviewId);
    if (!existing) {
      throw new DesignReviewNotFoundError();
    }
    if (existing.status === "approved" || existing.status === "rejected") {
      throw new DesignReviewStateError(
        `Review already ${existing.status}`,
      );
    }

    const updated = await deps.reviews.update(tenantId, reviewId, {
      status: parsed.decision === "approve" ? "approved" : "rejected",
      annotation: parsed.annotation ?? existing.annotation,
      decidedBy,
      decidedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new DesignReviewNotFoundError();
    }
    return updated;
  },
});
