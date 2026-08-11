import { connectMongo } from "@/lib/db/mongodb";
import { createClientService, type ClientService } from "./client-service";
import { createMongooseClientRepository } from "./mongoose-client-repository";

export const getClientService = async (): Promise<ClientService> => {
  await connectMongo();
  return createClientService(createMongooseClientRepository());
};
