import { it, expect } from "vitest";
import { createInMemoryPolicyGateRepository } from "./policy-gate-repository";
it("deduplicates concurrent gate creation and rejects changed intent", async () => {
  const repo = createInMemoryPolicyGateRepository();
  const input = {
    tenantId: "test",
    actionType: "client_email" as const,
    payload: { to: "lead@example.test" },
    requestedBy: "operator",
    correlationId: "run",
    requestKey: "pipeline:run",
  };
  const [a, b] = await Promise.all([repo.create(input), repo.create(input)]);
  expect(a.id).toBe(b.id);
  await expect(
    repo.create({ ...input, payload: { to: "other@example.test" } }),
  ).rejects.toThrow(/conflict/);
  expect((await repo.create({ ...input, tenantId: "other" })).id).not.toBe(
    a.id,
  );
});
