import { randomUUID } from "node:crypto";
import type { DesignReview, DesignReviewStatus } from "./schemas";

export type DesignReviewRepository = {
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
  getByTenantAndId: (
    tenantId: string,
    id: string,
  ) => Promise<DesignReview | null>;
  update: (
    tenantId: string,
    id: string,
    patch: {
      status: DesignReviewStatus;
      annotation?: string;
      decidedBy?: string;
      decidedAt?: string;
    },
  ) => Promise<DesignReview | null>;
};

export const createInMemoryDesignReviewRepository =
  (): DesignReviewRepository => {
    const reviews: DesignReview[] = [];

    return {
      create: async (input) => {
        const review: DesignReview = {
          id: randomUUID(),
          ...input,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        reviews.push(review);
        return review;
      },
      listByProject: async (tenantId, projectId) =>
        reviews.filter(
          (review) =>
            review.tenantId === tenantId && review.projectId === projectId,
        ),
      getByTenantAndId: async (tenantId, id) =>
        reviews.find(
          (review) => review.tenantId === tenantId && review.id === id,
        ) ?? null,
      update: async (tenantId, id, patch) => {
        const review = reviews.find(
          (entry) => entry.tenantId === tenantId && entry.id === id,
        );
        if (!review) {
          return null;
        }
        review.status = patch.status;
        if (patch.annotation !== undefined) {
          review.annotation = patch.annotation;
        }
        if (patch.decidedBy !== undefined) {
          review.decidedBy = patch.decidedBy;
        }
        if (patch.decidedAt !== undefined) {
          review.decidedAt = patch.decidedAt;
        }
        return review;
      },
    };
  };
