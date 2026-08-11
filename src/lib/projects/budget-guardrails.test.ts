import { describe, expect, it } from "vitest";
import { evaluateBudgetGuardrails } from "./budget-guardrails";

describe("evaluateBudgetGuardrails", () => {
  it("returns no thresholds when spend is below 80%", () => {
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 0 })).toEqual([]);
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 799 })).toEqual([]);
  });

  it("returns 80 when spend is at or above 80% but below 100%", () => {
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 800 })).toEqual([
      80,
    ]);
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 999 })).toEqual([
      80,
    ]);
  });

  it("returns 80 and 100 when spend is at or above 100% but below 120%", () => {
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 1000 })).toEqual([
      80, 100,
    ]);
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 1199 })).toEqual([
      80, 100,
    ]);
  });

  it("returns 80, 100, and 120 when spend is at or above 120%", () => {
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 1200 })).toEqual([
      80, 100, 120,
    ]);
    expect(evaluateBudgetGuardrails({ budget: 1000, spend: 5000 })).toEqual([
      80, 100, 120,
    ]);
  });

  it("treats zero budget with positive spend as all thresholds crossed", () => {
    expect(evaluateBudgetGuardrails({ budget: 0, spend: 1 })).toEqual([
      80, 100, 120,
    ]);
  });

  it("returns no thresholds when budget and spend are both zero", () => {
    expect(evaluateBudgetGuardrails({ budget: 0, spend: 0 })).toEqual([]);
  });
});
