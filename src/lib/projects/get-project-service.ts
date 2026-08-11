import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { getClientService } from "@/lib/clients/get-client-service";
import { connectMongo } from "@/lib/db/mongodb";
import { getSlackClient } from "@/lib/slack/get-slack-client";
import { createSlackNotifier } from "@/lib/slack/notify";
import { createMongooseBudgetAlertRepository } from "./mongoose-budget-alert-repository";
import { createMongooseProjectRepository } from "./mongoose-project-repository";
import { createProjectService, type ProjectService } from "./project-service";

export const getProjectService = async (): Promise<ProjectService> => {
  await connectMongo();
  const clients = await getClientService();
  const notifier = createSlackNotifier({
    slack: getSlackClient(),
    actionLogs: createMongooseAgentActionLogRepository(),
  });

  return createProjectService(
    createMongooseProjectRepository(),
    clients,
    createMongooseBudgetAlertRepository(),
    notifier,
  );
};
