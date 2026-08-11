import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { connectMongo } from "@/lib/db/mongodb";
import { getResendClient } from "@/lib/email/get-resend-client";
import {
  createResendAwareEffectRunner,
  getSharedDemoEffectStore,
} from "./demo-effects";
import { createMongoosePolicyGateRepository } from "./mongoose-policy-gate-repository";
import {
  createPolicyGateService,
  type PolicyGateService,
} from "./policy-gate-service";

export const getPolicyGateService = async (): Promise<PolicyGateService> => {
  await connectMongo();
  return createPolicyGateService(
    createMongoosePolicyGateRepository(),
    createMongooseAgentActionLogRepository(),
    createResendAwareEffectRunner(
      getSharedDemoEffectStore(),
      getResendClient(),
    ),
  );
};
