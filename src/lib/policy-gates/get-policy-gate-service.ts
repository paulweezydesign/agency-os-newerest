import { runDryRunEffect } from "./dry-run-effects";
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
  const notifier = {
    notifyPolicyGate: async (
      input: Parameters<
        ReturnType<typeof createSlackNotifier>["notifyPolicyGate"]
      >[0],
    ) =>
      createSlackNotifier({
        slack: getSlackClient(),
        actionLogs,
      }).notifyPolicyGate(input),
  };

  return createPolicyGateService(
    createMongoosePolicyGateRepository(),
    actionLogs,
    async (input) => {
      // Gates created by the beta workflow never reach provider adapters, even
      // if those factories acquire live implementations in a later change.
      if (input.workflowRunId || input.payload.executionMode === "dry-run")
        return runDryRunEffect(input);
      const base = createResendAwareEffectRunner(
        getSharedDemoEffectStore(),
        getResendClient(),
      );
      return createStripeAwareEffectRunner({ base, stripe: getStripeClient() })(
        input,
      );
    },
    notifier,
  );
};
