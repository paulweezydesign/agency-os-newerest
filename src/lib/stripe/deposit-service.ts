import type { PolicyGateService } from "@/lib/policy-gates/policy-gate-service";
import type { PolicyGate } from "@/lib/policy-gates/schemas";
import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import type { StripeCheckoutSession, StripeClient } from "./stripe-client";

export type DepositService = {
  requestDeposit: (input: {
    tenantId: string;
    projectId: string;
    amount: number;
    requestedBy: string;
    correlationId: string;
  }) => Promise<PolicyGate>;
  applyCheckoutCompleted: (input: {
    tenantId: string;
    projectId: string;
    amount: number;
    sessionId: string;
  }) => Promise<{ projectId: string; depositTotal: number }>;
};

export const createDepositService = (deps: {
  projects: Pick<ProjectService, "get" | "recordDeposit">;
  policyGates: Pick<PolicyGateService, "request">;
}): DepositService => ({
  requestDeposit: async ({
    tenantId,
    projectId,
    amount,
    requestedBy,
    correlationId,
  }) => {
    if (!(amount > 0)) {
      throw new Error("Deposit amount must be positive");
    }

    const project = await deps.projects.get(tenantId, projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return deps.policyGates.request({
      tenantId,
      actionType: "invoice_or_deposit",
      projectId,
      requestedBy,
      correlationId,
      payload: {
        kind: "deposit",
        amount,
        projectId,
        currency: "usd",
      },
    });
  },
  applyCheckoutCompleted: async ({
    tenantId,
    projectId,
    amount,
  }) => {
    const project = await deps.projects.recordDeposit({
      tenantId,
      projectId,
      amount,
    });
    return { projectId: project.id, depositTotal: project.depositTotal };
  },
});

export const createStripeAwareEffectRunner = (deps: {
  base: (
    input: {
      actionType: "client_email" | "sow_send" | "invoice_or_deposit";
      payload: Record<string, unknown>;
      projectId?: string;
      tenantId: string;
    },
  ) => Promise<unknown>;
  stripe: StripeClient;
  sessionsByGate?: Map<string, StripeCheckoutSession>;
}): ((input: {
  actionType: "client_email" | "sow_send" | "invoice_or_deposit";
  payload: Record<string, unknown>;
  projectId?: string;
  tenantId: string;
}) => Promise<unknown>) => {
  return async (args) => {
    if (args.actionType === "invoice_or_deposit") {
      const amount = args.payload.amount;
      const projectId =
        args.projectId ??
        (typeof args.payload.projectId === "string"
          ? args.payload.projectId
          : undefined);

      if (typeof amount !== "number" || !(amount > 0) || !projectId) {
        throw new Error("invoice_or_deposit requires amount and projectId");
      }

      const session = await deps.stripe.createCheckoutSession({
        tenantId: args.tenantId,
        projectId,
        amount,
        currency:
          typeof args.payload.currency === "string"
            ? args.payload.currency
            : "usd",
      });

      return {
        effectRan: true,
        kind: "invoice_or_deposit",
        session,
      };
    }

    return deps.base(args);
  };
};
