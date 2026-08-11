import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withRetry } from "./with-retry";

describe("withRetry", () => {
  it("returns on first success", async () => {
    const result = await withRetry(async () => "ok", { retries: 2 });
    expect(result).toBe("ok");
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error("Figma rate limited");
        }
        return "done";
      },
      { retries: 3, baseDelayMs: 1, sleep: async () => undefined },
    );

    expect(result).toBe("done");
    expect(calls).toBe(3);
  });

  it("does not retry non-transient errors", async () => {
    const op = vi.fn(async () => {
      throw new Error("Invalid Figma URL");
    });

    await expect(
      withRetry(op, {
        retries: 3,
        sleep: async () => undefined,
        shouldRetry: (error) =>
          error instanceof Error && /rate limit/i.test(error.message),
      }),
    ).rejects.toThrow(/Invalid Figma URL/);

    expect(op).toHaveBeenCalledTimes(1);
  });

  it("surfaces timeout errors", async () => {
    await expect(
      withRetry(async () => new Promise(() => undefined), {
        timeoutMs: 10,
        retries: 0,
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
