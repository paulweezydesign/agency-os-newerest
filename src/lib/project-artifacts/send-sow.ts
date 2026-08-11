import type { PolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import type { PolicyGate } from "@/lib/policy-gates/schemas";

/**
 * Queues a SOW send behind the policy gate. Does not deliver to the Client
 * until an operator approves; approve runs the existing demo effect for
 * `sow_send` (no real email).
 */
export const requestSowSendGate = (input: {
  policyGates: Pick<PolicyGateService, "request">;
  tenantId: string;
  projectId: string;
  artifactId: string;
  title: string;
  requestedBy: string;
  correlationId: string;
}): Promise<PolicyGate> =>
  input.policyGates.request({
    tenantId: input.tenantId,
    actionType: "sow_send",
    payload: {
      artifactId: input.artifactId,
      projectId: input.projectId,
      title: input.title,
    },
    projectId: input.projectId,
    requestedBy: input.requestedBy,
    correlationId: input.correlationId,
  });
