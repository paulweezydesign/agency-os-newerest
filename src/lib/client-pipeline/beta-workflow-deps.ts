import { isBetaWorkflowEnabled } from "./beta-workflow-enabled";
import { getClientService } from "@/lib/clients/get-client-service";
import { createMongoosePolicyGateRepository } from "@/lib/policy-gates/mongoose-policy-gate-repository";
import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { createPolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import {
  runDryRunEffect,
  syntheticEmailSchema,
} from "@/lib/policy-gates/dry-run-effects";
import { createClientPipelineService } from "./client-pipeline-service";

export const loadBetaWorkflowDeps = async () => {
  if (!isBetaWorkflowEnabled())
    throw new Error("Private beta workflow is disabled");
  const clients = await getClientService();
  const gates = createMongoosePolicyGateRepository();
  const logs = createMongooseAgentActionLogRepository();
  const policyGates = createPolicyGateService(gates, logs, runDryRunEffect);
  const domain = createClientPipelineService({ clients, policyGates });
  return {
    gates,
    logs,
    pipeline: {
      run: async (input: Parameters<typeof domain.run>[0]) => {
        const client = await clients.get(input.tenantId, input.clientId);
        if (!client) throw new Error("Client not found for tenant");
        if (client.contactEmail)
          syntheticEmailSchema.parse(client.contactEmail);
        return domain.run(input);
      },
    },
  };
};
