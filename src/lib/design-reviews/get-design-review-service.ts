import { getProjectService } from "@/lib/projects/get-project-service";
import { createInMemoryDesignReviewRepository } from "./design-review-repository";
import {
  createDesignReviewService,
  type DesignReviewService,
} from "./design-review-service";

let shared: DesignReviewService | null = null;

/** v1 in-memory design reviews (asset URL only; binary upload later). */
export const getDesignReviewService = async (): Promise<DesignReviewService> => {
  if (shared) {
    return shared;
  }

  const projects = await getProjectService();
  shared = createDesignReviewService({
    reviews: createInMemoryDesignReviewRepository(),
    projects,
  });
  return shared;
};
