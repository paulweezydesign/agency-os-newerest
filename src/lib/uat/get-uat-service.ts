import { getProjectService } from "@/lib/projects/get-project-service";
import { createInMemoryUatService, type UatService } from "./uat-service";

let shared: UatService | null = null;

export const getUatService = async (): Promise<UatService> => {
  if (shared) {
    return shared;
  }
  const projects = await getProjectService();
  shared = createInMemoryUatService({ projects });
  return shared;
};
