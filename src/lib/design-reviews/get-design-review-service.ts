import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { getFigmaClient } from "@/lib/figma/get-figma-client";
import { getProjectService } from "@/lib/projects/get-project-service";
import { createInMemoryDesignReviewRepository } from "./design-review-repository";
import {
  createDesignReviewService,
  type DesignReviewService,
} from "./design-review-service";

let shared: DesignReviewService | null = null;

/** v1 in-memory design reviews with optional mocked Figma deep-link. */
export const getDesignReviewService = async (): Promise<DesignReviewService> => {
  if (shared) {
    return shared;
  }

  const projects = await getProjectService();
  shared = createDesignReviewService({
    reviews: createInMemoryDesignReviewRepository(),
    projects,
    figma: getFigmaClient(),
    actionLogs: createInMemoryAgentActionLogRepository(),
  });
  return shared;
};
