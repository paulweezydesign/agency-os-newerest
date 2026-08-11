import { describe, expect, it } from "vitest";
import { runDemoPaths } from "./demo-paths";

describe("runDemoPaths", () => {
  it("covers lead → onboard and brief → SOW → scaffold", async () => {
    const result = await runDemoPaths();

    expect(result.leadToOnboard.branch).toBe("onboard");
    expect(result.leadToOnboard.stages).toContain("onboard");
    expect(result.briefToScaffold.kinds).toEqual([
      "brief",
      "mvp_scaffold",
      "sow",
    ]);
    expect(result.briefToScaffold.sowGateId.length).toBeGreaterThan(0);
  });
});
