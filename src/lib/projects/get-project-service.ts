import { getClientService } from "@/lib/clients/get-client-service";
import { connectMongo } from "@/lib/db/mongodb";
import { createMongooseProjectRepository } from "./mongoose-project-repository";
import { createProjectService, type ProjectService } from "./project-service";

export const getProjectService = async (): Promise<ProjectService> => {
  await connectMongo();
  const clients = await getClientService();
  return createProjectService(createMongooseProjectRepository(), clients);
};
