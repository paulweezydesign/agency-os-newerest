import { it, expect, vi } from "vitest";
import { runDryRunEffect } from "./dry-run-effects";
it("never makes outbound requests even with provider credentials present", async () => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-test-key");
  vi.stubEnv("STRIPE_SECRET_KEY", "synthetic-test-key");
  vi.stubEnv("SLACK_BOT_TOKEN", "synthetic-test-key");
  const fetch = vi.fn(() => {
    throw new Error("Outbound forbidden");
  });
  vi.stubGlobal("fetch", fetch);
  try {
    const input = {
      actionType: "client_email" as const,
      tenantId: "test",
      payload: { to: "lead@example.test" },
      idempotencyKey: "gate-test",
    };
    await expect(runDryRunEffect(input)).resolves.toMatchObject({
      mode: "dry-run",
      delivered: false,
    });
    await expect(
      runDryRunEffect({ ...input, payload: { to: "someone@example.com" } }),
    ).rejects.toThrow();
    await expect(
      runDryRunEffect({ ...input, actionType: "invoice_or_deposit" }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
