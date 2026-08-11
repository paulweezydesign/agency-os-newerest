import { randomUUID } from "node:crypto";
import type { BudgetGuardrailThreshold } from "./budget-guardrails";
import type { BudgetAlert } from "./schemas";

export type BudgetAlertCreateRecord = {
  tenantId: string;
  projectId: string;
  threshold: BudgetGuardrailThreshold;
  spend: number;
  budget: number;
};

export type BudgetAlertRepository = {
  createIfAbsent: (
    input: BudgetAlertCreateRecord,
  ) => Promise<BudgetAlert | null>;
  listByTenantAndProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<BudgetAlert[]>;
};

export const createInMemoryBudgetAlertRepository =
  (): BudgetAlertRepository => {
    const alerts: BudgetAlert[] = [];

    return {
      createIfAbsent: async (input) => {
        const exists = alerts.some(
          (alert) =>
            alert.tenantId === input.tenantId &&
            alert.projectId === input.projectId &&
            alert.threshold === input.threshold,
        );

        if (exists) {
          return null;
        }

        const created: BudgetAlert = {
          id: randomUUID(),
          ...input,
          createdAt: new Date().toISOString(),
        };
        alerts.push(created);
        return created;
      },
      listByTenantAndProject: async (tenantId, projectId) =>
        alerts
          .filter(
            (alert) =>
              alert.tenantId === tenantId && alert.projectId === projectId,
          )
          .slice()
          .sort((a, b) => a.threshold - b.threshold),
    };
  };
