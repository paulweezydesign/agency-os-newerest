import { describe, expect, it, vi } from "vitest";
import {
  createWorkflowController,
  workflowStorageKey,
} from "./workflow-controller";

const uuid = "99530f56-aab4-4dfe-9704-75fe0317eeda";
const nextUuid = "d8afee24-6d9e-48cd-8158-b8d783953926";
const result = (
  state = "suspended",
  status = "pending",
  effectStatus?: string,
) => ({
  tenantId: "tenant-a", clientId: "client-a", mastraRunId: "engine-test", checkpoints: [],
  status: "awaiting_approval", engineState: state,
  runId: uuid,
  correlationId: "correlation-test",
  gates: [{ id: "0123456789abcdef01234567", status, effectStatus: effectStatus === "completed" ? "succeeded" : effectStatus === "claimed" ? "running" : effectStatus === "uncertain" ? "unknown" : effectStatus,
    tenantId: "tenant-a", actionType: "client_email", payload: {}, requestedBy: "operator", correlationId: "test", createdAt: "test", dryRun: true,
    effectRan: effectStatus === "completed", ...(effectStatus === "completed" ? { effectReceipt: { mode: "dry-run", key: "policy-gate:0123456789abcdef01234567", recordedAt: "test" } } : {}) }],
});
const setup = () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(result()), { status: 200 }),
  );
  const deps = {
    tenantId: "tenant-a",
    clientId: "client-a",
    storage,
    fetcher,
    uuid: vi.fn(() => uuid),
    withLock: async (_: string, work: () => Promise<void>) => work(),
  };
  return {
    entries,
    storage,
    fetcher,
    deps,
    controller: createWorkflowController(deps),
  };
};

describe("durable workflow operator controller", () => {
  it("retains one identity before sending and suppresses double submission", async () => {
    const { controller, deps, fetcher, entries } = setup();
    await controller.restore();
    await Promise.all([controller.start("70"), controller.start("70")]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toEqual([
      "/api/clients/client-a/workflow",
      expect.objectContaining({
        body: JSON.stringify({
          operation: "start",
          runId: uuid,
          leadScore: 70,
        }),
      }),
    ]);
    expect(
      JSON.parse(entries.get(workflowStorageKey("tenant-a", "client-a"))!),
    ).toEqual({ version: 1, requestId: uuid, leadScore: 70 });
    expect(deps.uuid).toHaveBeenCalledTimes(1);
  });
  it("reuses the saved identity after a lost response and reload", async () => {
    const { controller, deps, fetcher } = setup();
    await controller.restore();
    fetcher.mockRejectedValueOnce(new Error("connection lost"));
    await controller.start("70");
    const reloaded = createWorkflowController(deps);
    await reloaded.restore();
    expect(reloaded.getSnapshot().retained?.requestId).toBe(uuid);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({
      operation: "inspect",
      runId: uuid,
    });
    expect(deps.uuid).toHaveBeenCalledTimes(1);
  });
  it("retries an unconfirmed start with exactly the same payload", async () => {
    const { controller, fetcher } = setup();
    await controller.restore();
    fetcher.mockRejectedValueOnce(new Error("lost response"));
    await controller.start("45");
    await controller.start("45");
    expect(fetcher.mock.calls[0]).toEqual(fetcher.mock.calls[1]);
  });
  it.each(["", " ", "-1", "101", "1.5", "7e1", "NaN"])(
    "rejects malformed score %s without a request",
    async (score) => {
      const { controller, fetcher, entries } = setup();
      await controller.restore();
      await controller.start(score);
      expect(controller.getSnapshot().error).toBeTruthy();
      expect(fetcher).not.toHaveBeenCalled();
      expect(entries.size).toBe(0);
    },
  );
  it("rejects changed input under an existing identity", async () => {
    const { controller, fetcher } = setup();
    await controller.restore();
    fetcher.mockRejectedValueOnce(new Error("lost response"));
    await controller.start("70");
    await controller.start("45");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().error).toMatch(/score|input/i);
  });
  it("never reads another tenant or client's retained run", async () => {
    const { deps, controller, fetcher } = setup();
    await controller.restore();
    await controller.start("70");
    for (const scope of [{ tenantId: "tenant-b" }, { clientId: "client-b" }]) {
      const other = createWorkflowController({ ...deps, ...scope });
      await other.restore();
      expect(other.getSnapshot().retained).toBeNull();
      expect(other.getSnapshot().result).toBeNull();
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["running", "uncertain"])(
    "blocks new runs and resume for %s admission",
    async (state) => {
      const { controller, fetcher, deps } = setup();
      await controller.restore();
      fetcher.mockResolvedValue(new Response(JSON.stringify(result(state))));
      // Each mocked request needs a fresh body.
      fetcher.mockImplementation(
        async () => new Response(JSON.stringify(result(state))),
      );
      await controller.start("70");
      await controller.resume();
      await controller.startNew();
      expect(deps.uuid).toHaveBeenCalledTimes(1);
      expect(
        fetcher.mock.calls.every(
          (call) => JSON.parse(call[1]!.body as string).operation !== "resume",
        ),
      ).toBe(true);
      expect(controller.getSnapshot().error).toBeTruthy();
    },
  );
  it.each(["claimed", "uncertain"])(
    "blocks resume for a gate with %s execution",
    async (executionState) => {
      const { controller, fetcher } = setup();
      fetcher.mockImplementation(
        async () =>
          new Response(
            JSON.stringify(result("suspended", "pending", executionState)),
          ),
      );
      await controller.restore();
      await controller.start("70");
      await controller.resume();
      expect(
        fetcher.mock.calls.every(
          (call) => JSON.parse(call[1]!.body as string).operation !== "resume",
        ),
      ).toBe(true);
    },
  );
  it("requires a terminal human decision before resume; sends no approval boolean", async () => {
    const { controller, fetcher } = setup();
    await controller.restore();
    await controller.start("70");
    await controller.resume();
    expect(controller.getSnapshot().error).toMatch(/decision|approval/i);
    fetcher.mockImplementation(
      async (_url, init) =>
        new Response(
          JSON.stringify(
            result(
              JSON.parse(init!.body as string).operation === "resume"
                ? "success"
                : "suspended",
              "denied",
            ),
          ),
        ),
    );
    await controller.resume();
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string)).toEqual({
      operation: "resume",
      runId: uuid,
    });
    expect(controller.getSnapshot().result?.state).toBe("success");
  });
  it("never replaces the immutable Client run even after completion", async () => {
    const { controller, fetcher, deps } = setup();
    fetcher.mockImplementation(async () => new Response(JSON.stringify(result("success", "approved", "completed"))));
    await controller.restore();
    await controller.start("70");
    await controller.startNew();
    expect(deps.uuid).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().error).toMatch(/immutable/);
  });
  it.each([400, 401, 403, 409, 500])(
    "keeps identity and never falls back after HTTP %s",
    async (status) => {
      const { controller, fetcher } = setup();
      fetcher.mockImplementation(
        async () =>
          new Response(JSON.stringify({ error: "Rejected" }), { status }),
      );
      await controller.restore();
      await controller.start("70");
      expect(controller.getSnapshot().retained?.requestId).toBe(uuid);
      expect(controller.getSnapshot().result).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][0]).toMatch(/\/workflow$/);
    },
  );
  it("fails closed on malformed successful responses and inaccessible storage", async () => {
    const { controller, fetcher, deps } = setup();
    fetcher.mockImplementation(
      async () => new Response(JSON.stringify({ state: "success" })),
    );
    await controller.restore();
    await controller.start("70");
    expect(controller.getSnapshot().result).toBeNull();
    expect(controller.getSnapshot().error).toBeTruthy();
    const inaccessible = createWorkflowController({
      ...deps,
      storage: {
        getItem: () => {
          throw new Error("storage blocked");
        },
        setItem: vi.fn(),
      },
    });
    await inaccessible.restore();
    await inaccessible.start("70");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("does not replace a retained run after storage is removed or corrupted", async () => {
  const { controller, entries, fetcher, deps } = setup();
  await controller.restore();
  await controller.start("70");
  entries.clear();
  await controller.inspect();
  await controller.start("70");
  expect(deps.uuid).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().retained?.requestId).toBe(uuid);
  entries.set(workflowStorageKey("tenant-a", "client-a"), "not-json");
  await controller.start("70");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not send if retaining a new identity fails", async () => {
  const { deps, fetcher } = setup();
  const controller = createWorkflowController({
    ...deps,
    storage: {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage full");
      },
    },
  });
  await controller.restore();
  await controller.start("70");
  expect(fetcher).not.toHaveBeenCalled();
  expect(controller.getSnapshot().error).toBe("storage full");
});
it("blocks stale tab actions when a different saved run appears", async () => {
  const { deps, entries, fetcher, controller } = setup();
  await controller.restore();
  await controller.start("70");
  entries.set(
    workflowStorageKey("tenant-a", "client-a"),
    JSON.stringify({ version: 1, requestId: nextUuid, leadScore: 45 }),
  );
  await controller.startNew();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(deps.uuid).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().error).toMatch(/another tab/);
  await controller.inspect();
  expect(controller.getSnapshot().retained?.requestId).toBe(nextUuid);
});

it("retries an inspected idle admission with the same identity", async () => {
  const { controller, fetcher, deps } = setup();
  fetcher.mockImplementation(async () => new Response(JSON.stringify(result("idle"))));
  await controller.restore(); await controller.start("70");
  const reloaded = createWorkflowController(deps); await reloaded.restore();
  await reloaded.start("70");
  expect(deps.uuid).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string)).toEqual({ operation: "start", runId: uuid, leadScore: 70 });
});

it.each([{ tenantId: "other" }, { clientId: "other" }, { runId: nextUuid }])("rejects a successful response with mismatched identity", async (substitution) => {
  const { controller, fetcher } = setup();
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ ...result(), ...substitution })));
  await controller.restore(); await controller.start("70");
  expect(controller.getSnapshot().result).toBeNull();
  expect(controller.getSnapshot().error).toMatch(/could not be verified/);
});
