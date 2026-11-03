import { z } from "zod";
import {
  workflowViewSchema,
  canResumeWorkflow,
  canStartNewWorkflow,
  type WorkflowView,
} from "./workflow-view";

const savedRunSchema = z
  .object({
    version: z.literal(1),
    requestId: z.string().uuid(),
    leadScore: z.number().int().min(0).max(100),
  })
  .strict();
type SavedRun = z.infer<typeof savedRunSchema>;
export const workflowStorageKey = (tenantId: string, clientId: string) =>
  `agencyos:client-pipeline:v1:${JSON.stringify([tenantId, clientId])}`;
export type WorkflowControllerState = {
  ready: boolean;
  busy: boolean;
  retained: SavedRun | null;
  result: WorkflowView | null;
  error: string | null;
};
export type WorkflowControllerDeps = {
  tenantId: string;
  clientId: string;
  storage: Pick<Storage, "getItem" | "setItem">;
  fetcher: typeof fetch;
  uuid: () => string;
  withLock: (key: string, work: () => Promise<void>) => Promise<void>;
};

export const createWorkflowController = (deps: WorkflowControllerDeps) => {
  const key = workflowStorageKey(deps.tenantId, deps.clientId);
  const listeners = new Set<() => void>();
  let state: WorkflowControllerState = {
    ready: false,
    busy: false,
    retained: null,
    result: null,
    error: null,
  };
  const patch = (update: Partial<WorkflowControllerState>) => {
    state = { ...state, ...update };
    listeners.forEach((notify) => notify());
  };
  const read = () => {
    const raw = deps.storage.getItem(key);
    const parsed = raw === null ? null : savedRunSchema.parse(JSON.parse(raw));
    return parsed;
  };
  const current = () => {
    const saved = read();
    if (state.retained && state.retained.requestId !== saved?.requestId) {
      patch({ result: null });
      throw new Error(
        "The saved run changed in another tab. Inspect it before continuing.",
      );
    }
    patch({ retained: saved });
    return saved;
  };
  const score = (raw: string) => {
    if (!/^\d+$/.test(raw.trim()))
      throw new Error("Enter a whole-number lead score from 0 to 100.");
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 100)
      throw new Error("Enter a whole-number lead score from 0 to 100.");
    return n;
  };
  const request = async (
    saved: SavedRun,
    operation: "start" | "inspect" | "resume",
  ) => {
    // An old success must never remain actionable after an unverified response.
    patch({ result: null });
    const response = await deps.fetcher(
      `/api/clients/${encodeURIComponent(deps.clientId)}/pipeline/workflow`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          requestId: saved.requestId,
          ...(operation === "start" ? { leadScore: saved.leadScore } : {}),
        }),
      },
    );
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = z.object({ error: z.string() }).safeParse(body);
      throw new Error(
        error.success
          ? error.data.error
          : `Workflow request failed (${response.status}).`,
      );
    }
    const parsed = workflowViewSchema.safeParse(body);
    if (!parsed.success)
      throw new Error(
        "The workflow response could not be verified. Inspect this saved run; do not create a replacement.",
      );
    patch({ result: parsed.data });
    return parsed.data;
  };
  const act = async (work: () => Promise<void>) => {
    // Synchronous guard covers clicks before React has rendered disabled controls.
    if (state.busy) return;
    patch({ busy: true, error: null });
    try {
      await deps.withLock(key, work);
    } catch (error) {
      patch({
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify this workflow. Inspect the saved run before retrying.",
      });
    } finally {
      patch({ busy: false, ready: true });
    }
  };
  const save = (leadScore: number) => {
    const saved = savedRunSchema.parse({
      version: 1,
      requestId: deps.uuid(),
      leadScore,
    });
    // Never send before durable browser retention succeeds.
    deps.storage.setItem(key, JSON.stringify(saved));
    patch({ retained: saved, result: null });
    return saved;
  };
  const inspect = () =>
    act(async () => {
      patch({ result: null });
      const saved = read();
      if (state.retained && !saved)
        throw new Error(
          "Saved identity was removed from browser storage. Keep the recorded request ID for review; do not create a replacement run.",
        );
      patch({ retained: saved, result: null });
      if (saved) await request(saved, "inspect");
    });
  return {
    getSnapshot: () => state,
    subscribe: (notify: () => void) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    restore: inspect,
    inspect,
    start: (rawScore: string) =>
      act(async () => {
        const leadScore = score(rawScore);
        const saved = current();
        if (saved && saved.leadScore !== leadScore)
          throw new Error(
            "This score differs from the saved run. Inspect it; a new run is available only after completion.",
          );
        if (saved && state.result)
          throw new Error(
            "Inspect or resume the existing run. Use Start new run only after completion.",
          );
        await request(saved ?? save(leadScore), "start");
      }),
    resume: () =>
      act(async () => {
        const saved = current();
        if (!saved) throw new Error("No saved run to resume.");
        const fresh = await request(saved, "inspect");
        if (!canResumeWorkflow(fresh))
          throw new Error(
            "Resume is blocked until the human decision is terminal and the workflow is safely suspended. Inspect or review the approval gate.",
          );
        await request(saved, "resume");
      }),
    startNew: (rawScore: string) =>
      act(async () => {
        const leadScore = score(rawScore);
        const saved = current();
        if (!saved)
          throw new Error("Use Run dry-run pipeline to start your first run.");
        const fresh = await request(saved, "inspect");
        if (!canStartNewWorkflow(fresh))
          throw new Error(
            "A new run is blocked until the existing workflow has completed. Do not replace an uncertain run.",
          );
        await request(save(leadScore), "start");
      }),
  };
};
