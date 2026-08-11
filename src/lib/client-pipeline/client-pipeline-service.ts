import { requestClientEmailGate } from "@/lib/email/request-client-email";
import type { ClientService } from "@/lib/clients/client-service";
import type { Client, PipelineStage } from "@/lib/clients/schemas";
import type { PolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import type { PolicyGate } from "@/lib/policy-gates/schemas";

export const HIGH_LEAD_SCORE = 70;
export const MID_LEAD_SCORE = 40;

export type PipelineStep = {
  stage: PipelineStage;
  agentRole: "prospector" | "nurture" | "onboarding";
  note: string;
  emailGateId?: string;
};

export type RunClientPipelineInput = {
  tenantId: string;
  clientId: string;
  leadScore: number;
  contactEmail?: string;
  requestedBy: string;
  correlationId: string;
};

export type RunClientPipelineResult = {
  client: Client;
  branch: "onboard" | "nurture" | "prospect";
  steps: PipelineStep[];
  pendingEmailGates: PolicyGate[];
};

export type ClientPipelineService = {
  run: (input: RunClientPipelineInput) => Promise<RunClientPipelineResult>;
};

const resolveBranch = (
  leadScore: number,
): RunClientPipelineResult["branch"] => {
  if (leadScore >= HIGH_LEAD_SCORE) {
    return "onboard";
  }
  if (leadScore >= MID_LEAD_SCORE) {
    return "nurture";
  }
  return "prospect";
};

export const createClientPipelineService = (deps: {
  clients: ClientService;
  policyGates: Pick<PolicyGateService, "request">;
}): ClientPipelineService => ({
  run: async (input) => {
    const existing = await deps.clients.get(input.tenantId, input.clientId);
    if (!existing) {
      throw new Error("Client not found for tenant");
    }

    const contactEmail = input.contactEmail ?? existing.contactEmail;
    const branch = resolveBranch(input.leadScore);
    const steps: PipelineStep[] = [];
    const pendingEmailGates: PolicyGate[] = [];

    let client = await deps.clients.updatePipeline(
      input.tenantId,
      input.clientId,
      {
        pipelineStage: "prospect",
        leadScore: input.leadScore,
        contactEmail,
      },
    );
    steps.push({
      stage: "prospect",
      agentRole: "prospector",
      note: "Prospector scored and entered the lead into the pipeline.",
    });

    client = await deps.clients.updatePipeline(input.tenantId, input.clientId, {
      pipelineStage: "qualify",
      leadScore: input.leadScore,
      contactEmail,
    });
    steps.push({
      stage: "qualify",
      agentRole: "prospector",
      note: `Qualified with lead score ${input.leadScore}.`,
    });

    if (branch === "prospect") {
      client = await deps.clients.updatePipeline(
        input.tenantId,
        input.clientId,
        {
          pipelineStage: "disqualified",
          leadScore: input.leadScore,
          contactEmail,
        },
      );
      steps.push({
        stage: "disqualified",
        agentRole: "prospector",
        note: "Lead score below nurture threshold; marked disqualified.",
      });
      return { client, branch, steps, pendingEmailGates };
    }

    if (branch === "nurture") {
      client = await deps.clients.updatePipeline(
        input.tenantId,
        input.clientId,
        {
          pipelineStage: "nurture",
          leadScore: input.leadScore,
          contactEmail,
        },
      );

      let emailGateId: string | undefined;
      if (contactEmail) {
        const gate = await requestClientEmailGate({
          policyGates: deps.policyGates,
          tenantId: input.tenantId,
          clientId: input.clientId,
          to: contactEmail,
          subject: `Nurture follow-up for ${client.name}`,
          body: `Hi ${client.name}, thanks for your interest. We'll share next steps shortly.`,
          requestedBy: input.requestedBy,
          correlationId: input.correlationId,
        });
        pendingEmailGates.push(gate);
        emailGateId = gate.id;
      }

      steps.push({
        stage: "nurture",
        agentRole: "nurture",
        note: contactEmail
          ? "Nurture teammate queued a policy-gated client email."
          : "Nurture stage reached; no contact email available to gate.",
        emailGateId,
      });
      return { client, branch, steps, pendingEmailGates };
    }

    client = await deps.clients.updatePipeline(input.tenantId, input.clientId, {
      pipelineStage: "onboard",
      leadScore: input.leadScore,
      contactEmail,
    });

    let emailGateId: string | undefined;
    if (contactEmail) {
      const gate = await requestClientEmailGate({
        policyGates: deps.policyGates,
        tenantId: input.tenantId,
        clientId: input.clientId,
        to: contactEmail,
        subject: `Welcome aboard, ${client.name}`,
        body: `Hi ${client.name}, welcome to AgencyOS onboarding. Your operator will follow up after approval.`,
        requestedBy: input.requestedBy,
        correlationId: input.correlationId,
      });
      pendingEmailGates.push(gate);
      emailGateId = gate.id;
    }

    steps.push({
      stage: "onboard",
      agentRole: "onboarding",
      note: contactEmail
        ? "Onboarding teammate queued a policy-gated welcome email."
        : "Onboarding stage reached; no contact email available to gate.",
      emailGateId,
    });

    return { client, branch, steps, pendingEmailGates };
  },
});
