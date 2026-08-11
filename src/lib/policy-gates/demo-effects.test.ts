import { describe, expect, it } from "vitest";
import {
  createDemoEffectRunner,
  createDemoEffectStore,
} from "./demo-effects";

describe("createDemoEffectRunner", () => {
  it("records client_email side effects for approve-path demos", async () => {
    const store = createDemoEffectStore();
    const runEffect = createDemoEffectRunner(store);

    const result = await runEffect({
      actionType: "client_email",
      payload: { to: "client@example.com" },
      tenantId: "tenant-a",
    });

    expect(store.runCount()).toBe(1);
    expect(result).toMatchObject({
      effectRan: true,
      kind: "client_email",
    });
  });
});
