export const BUDGET_GUARDRAIL_THRESHOLDS = [80, 100, 120] as const;

export type BudgetGuardrailThreshold =
  (typeof BUDGET_GUARDRAIL_THRESHOLDS)[number];

export type EvaluateBudgetGuardrailsInput = {
  budget: number;
  spend: number;
};

export const evaluateBudgetGuardrails = ({
  budget,
  spend,
}: EvaluateBudgetGuardrailsInput): BudgetGuardrailThreshold[] => {
  if (spend <= 0) {
    return [];
  }

  if (budget <= 0) {
    return [...BUDGET_GUARDRAIL_THRESHOLDS];
  }

  const ratioPercent = (spend / budget) * 100;

  return BUDGET_GUARDRAIL_THRESHOLDS.filter(
    (threshold) => ratioPercent >= threshold,
  );
};
