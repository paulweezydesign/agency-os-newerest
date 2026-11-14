import { describe, expect, it } from "vitest";
import { getTaskModel } from "./task-model";

describe("Task schema indexes", () => {
  it.each(["mondayItemId", "linearIssueId"])("declares one compatible %s index", field => {
    const indexes = getTaskModel().schema.indexes().filter(([keys]) => field in keys);
    expect(indexes).toHaveLength(1);
    // Keep the ordinary index created by existing deployments. Changing its
    // options would require an explicit migration, not automatic initialization.
    expect(indexes[0]![0]).toEqual({ [field]: 1 });
    expect(indexes[0]![1].sparse).not.toBe(true);
  });
});
