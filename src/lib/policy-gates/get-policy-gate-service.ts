import { createMongooseAgentActionLogRepository } from "@/lib/agent-action-logs/mongoose-agent-action-log-repository";
import { connectMongo } from "@/lib/db/mongodb";
import { getResendClient } from "@/lib/email/get-resend-client";
import { getSlackClient } from "@/lib/slack/get-slack-client";
import { createSlackNotifier } from "@/lib/slack/notify";
import { createStripeAwareEffectRunner } from "@/lib/stripe/deposit-service";
import { getStripeClient } from "@/lib/stripe/get-stripe-client";
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
  const actionLogs = createMongooseAgentActionLogRepository();
  const notifier = createSlackNotifier({
    slack: getSlackClient(),
    actionLogs,
  });
  const base = createResendAwareEffectRunner(
    getSharedDemoEffectStore(),
    getResendClient(),
  );

  return createPolicyGateService(
    createMongoosePolicyGateRepository(),
    actionLogs,
    createStripeAwareEffectRunner({
      base,
      stripe: getStripeClient(),
    }),
    notifier,
  );
};
