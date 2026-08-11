import { getClientService } from "@/lib/clients/get-client-service";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import {
  createClientPipelineService,
  type ClientPipelineService,
} from "./client-pipeline-service";

export const getClientPipelineService =
  async (): Promise<ClientPipelineService> => {
    const [clients, policyGates] = await Promise.all([
      getClientService(),
      getPolicyGateService(),
    ]);
    return createClientPipelineService({ clients, policyGates });
  };
