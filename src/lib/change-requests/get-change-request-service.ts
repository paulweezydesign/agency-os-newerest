import { getProjectService } from "@/lib/projects/get-project-service";
import { createInMemoryChangeRequestRepository } from "./change-request-repository";
import {
  createChangeRequestService,
  type ChangeRequestService,
} from "./change-request-service";

let shared: ChangeRequestService | null = null;

export const getChangeRequestService =
  async (): Promise<ChangeRequestService> => {
    if (shared) {
      return shared;
    }
    const projects = await getProjectService();
    shared = createChangeRequestService({
      changeRequests: createInMemoryChangeRequestRepository(),
      projects,
    });
    return shared;
  };
