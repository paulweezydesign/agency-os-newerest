import { randomUUID } from "node:crypto";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import {
  FigmaClientError,
  parseFigmaFileKey,
  type FigmaClient,
} from "@/lib/figma/figma-client";
import { withRetry } from "@/lib/http/with-retry";
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

export class FigmaAttachError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaAttachError";
  }
}

export type DesignReviewService = {
  create: (input: {
    tenantId: string;
    projectId: string;
    title: string;
    assetUrl?: string;
    figmaUrl?: string;
    notes?: string;
    correlationId?: string;
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
  figma?: FigmaClient;
  actionLogs?: AgentActionLogRepository;
}): DesignReviewService => ({
  create: async ({
    tenantId,
    projectId,
    correlationId = randomUUID(),
    ...input
  }) => {
    const parsed = createDesignReviewInputSchema.parse(input);
    const project = await deps.projects.get(tenantId, projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    let figmaUrl = parsed.figmaUrl;
    let figmaFileKey: string | undefined;
    let figmaFileName: string | undefined;
    let assetUrl = parsed.assetUrl;

    if (figmaUrl) {
      if (!deps.figma) {
        throw new FigmaAttachError(
          "Figma client is not configured for design reviews",
        );
      }

      try {
        figmaFileKey = parseFigmaFileKey(figmaUrl);
        const file = await withRetry(
          () => deps.figma!.getFile({ fileKey: figmaFileKey! }),
          {
            retries: 2,
            timeoutMs: 5_000,
            shouldRetry: (error) =>
              error instanceof FigmaClientError &&
              /unavailable|rate limit|timeout/i.test(error.message),
          },
        );
        figmaFileName = file.name;
        assetUrl ??= figmaUrl;

        await deps.actionLogs?.append({
          tenantId,
          projectId,
          agentName: "design-review",
          toolName: "figma.getFile",
          input: { figmaUrl, fileKey: figmaFileKey },
          output: file,
          status: "success",
          correlationId,
        });
      } catch (error) {
        const message =
          error instanceof FigmaClientError || error instanceof Error
            ? error.message
            : "Unknown Figma error";

        await deps.actionLogs?.append({
          tenantId,
          projectId,
          agentName: "design-review",
          toolName: "figma.getFile",
          input: { figmaUrl },
          output: { error: message },
          status: "error",
          correlationId,
        });

        throw new FigmaAttachError(
          `Failed to attach Figma file: ${message}. Fix the link or token and retry.`,
        );
      }
    }

    if (!assetUrl) {
      throw new FigmaAttachError("assetUrl or figmaUrl is required");
    }

    return deps.reviews.create({
      tenantId,
      projectId,
      title: parsed.title,
      assetUrl,
      figmaUrl,
      figmaFileKey,
      figmaFileName,
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
