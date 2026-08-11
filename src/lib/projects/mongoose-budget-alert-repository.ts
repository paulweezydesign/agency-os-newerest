import type {
  BudgetAlertCreateRecord,
  BudgetAlertRepository,
} from "./budget-alert-repository";
import { getBudgetAlertModel } from "./budget-alert-model";
import type { BudgetAlert } from "./schemas";
import type { BudgetGuardrailThreshold } from "./budget-guardrails";

const toBudgetAlert = (doc: {
  _id: { toString: () => string };
  tenantId: string;
  projectId: string;
  threshold: number;
  spend: number;
  budget: number;
  createdAt: Date;
}): BudgetAlert => ({
  id: doc._id.toString(),
  tenantId: doc.tenantId,
  projectId: doc.projectId,
  threshold: doc.threshold as BudgetGuardrailThreshold,
  spend: doc.spend,
  budget: doc.budget,
  createdAt: doc.createdAt.toISOString(),
});

export const createMongooseBudgetAlertRepository =
  (): BudgetAlertRepository => ({
    createIfAbsent: async (input: BudgetAlertCreateRecord) => {
      const model = getBudgetAlertModel();

      try {
        const doc = await model.create(input);
        return toBudgetAlert(doc);
      } catch (error) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "number"
            ? error.code
            : null;

        if (code === 11000) {
          return null;
        }

        throw error;
      }
    },
    listByTenantAndProject: async (tenantId, projectId) => {
      const model = getBudgetAlertModel();
      const docs = await model
        .find({ tenantId, projectId })
        .sort({ threshold: 1 })
        .exec();
      return docs.map(toBudgetAlert);
    },
  });
