import type { PolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import type { PolicyGate } from "@/lib/policy-gates/schemas";

/**
 * Queues a client-facing email behind the policy gate. Does not call Resend
 * until an operator approves; approve runs the client_email effect.
 */
export const requestClientEmailGate = (input: {
  policyGates: Pick<PolicyGateService, "request">;
  tenantId: string;
  clientId: string;
  to: string;
  subject: string;
  body: string;
  projectId?: string;
  requestedBy: string;
  correlationId: string;
}): Promise<PolicyGate> =>
  input.policyGates.request({
    tenantId: input.tenantId,
    actionType: "client_email",
    payload: {
      clientId: input.clientId,
      to: input.to,
      subject: input.subject,
      body: input.body,
    },
    projectId: input.projectId,
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
  });
