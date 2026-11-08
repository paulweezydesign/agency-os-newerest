"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  createWorkflowController,
  workflowStorageKey,
} from "@/lib/client-pipeline/workflow-controller";
import {
  canResumeWorkflow,
  type WorkflowView,
} from "@/lib/client-pipeline/workflow-view";

const admissionLabels: Record<WorkflowView["state"], string> = {
  idle: "Input saved. Retry the same run to claim execution.",
  running:
    "Running or interrupted. Inspect again; automatic restart is blocked.",
  suspended:
    "Paused at human approval. Inspect after deciding the gate, then resume.",
  success:
    "Workflow completed. Any approved effect was a dry run; no delivery occurred.",
  uncertain:
    "Outcome uncertain. Execution is blocked for review; do not create a replacement run.",
};
export const WorkflowRunStatus = ({ view }: { view: WorkflowView }) => (
  <section aria-label="Saved workflow status" className="space-y-2 text-sm">
    <p role="status" aria-live="polite">
      {admissionLabels[view.state]}
    </p>
    <dl className="break-all">
      <dt>Run ID</dt>
      <dd>{view.runId}</dd>
      <dt>Mastra run ID</dt>
      <dd>{view.mastraRunId}</dd>
      <dt>Correlation ID</dt>
      <dd>{view.correlationId}</dd>
      <dt>Admission state</dt>
      <dd>{view.state}</dd>
    </dl>
    {view.gates.length === 0 ? (
      <p>No approval gate is currently recorded for this run.</p>
    ) : (
      <ul aria-label="Human approval gates">
        {view.gates.map((gate) => (
          <li key={gate.id}>
            <Link
              className="underline"
              href={`/dashboard/policy-gates?gateId=${encodeURIComponent(gate.id)}#gate-${gate.id}`}
            >
              Review gate {gate.id}
            </Link>
            {" — "}
            {gate.status}
            {gate.executionState ? `; legacy execution ${gate.executionState}, blocked for reconciliation` : ""}
            {gate.status === "approved" ? (gate.effectRan && gate.effectReceipt
              ? "; dry-run receipt recorded"
              : `; effect ${gate.effectStatus ?? "unconfirmed"}, resume blocked; review explicit dry-run recovery`) : ""}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const DurablePipelineForm = ({
  tenantId,
  clientId,
  syntheticContact,
}: {
  tenantId: string;
  clientId: string;
  syntheticContact: boolean;
}) => {
  const router = useRouter();
  const [controller] = useState(() =>
    createWorkflowController({
      tenantId,
      clientId,
      storage: {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      },
      fetcher: (...args) => fetch(...args),
      uuid: () => crypto.randomUUID(),
      withLock: async (key, work) => {
        if (!navigator.locks)
          throw new Error(
            "This browser cannot safely coordinate saved runs. Use a browser with Web Locks support.",
          );
        await navigator.locks.request(key, work);
      },
    }),
  );
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [leadScore, setLeadScore] = useState("70");
  useEffect(() => {
    if (view.result) router.refresh();
  }, [view.result, router]);
  useEffect(() => {
    void controller.restore();
    const changed = (event: StorageEvent) => {
      // Inspection always uses this controller's tenant/client key.
      if (
        event.storageArea === window.localStorage &&
        (event.key === null ||
          event.key === workflowStorageKey(tenantId, clientId))
      )
        void controller.inspect();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [controller, tenantId, clientId]);
  const retainedScore = view.retained?.leadScore;
  const retainedId = view.retained?.requestId;
  useEffect(() => {
    if (retainedScore !== undefined) setLeadScore(String(retainedScore));
  }, [retainedId, retainedScore]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (syntheticContact) void controller.start(leadScore);
  };
  const button =
    "rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={onSubmit}
      aria-label="Durable dry-run client pipeline"
      aria-busy={view.busy}
    >
      <p className="text-sm">
        Private beta dry run. No emails, payments, or notifications are sent.
      </p>
      {!syntheticContact && (
        <p role="status">
          A saved contact ending in .test is required to start a run. Existing
          runs can still be inspected.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Lead score (0–100)
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          type="number"
          min={0}
          max={100}
          step={1}
          required
          value={leadScore}
          disabled={
            !view.ready || view.busy || Boolean(view.retained)
          }
          onChange={(event) => setLeadScore(event.target.value)}
        />
      </label>
      {view.retained && (
        <p className="break-all text-xs">
          Saved request ID: {view.retained.requestId} · saved score:{" "}
          {view.retained.leadScore}
        </p>
      )}
      {view.error && (
        <p role="alert" className="text-sm text-red-700">
          {view.error}
        </p>
      )}
      {!view.ready && <p role="status">Restoring saved run…</p>}
      {view.result && <WorkflowRunStatus view={view.result} />}
      <div className="flex flex-wrap gap-2">
        {(!view.result || view.result.state === "idle") && (
          <button
            className={button}
            type="submit"
            disabled={!view.ready || view.busy || !syntheticContact}
          >
            {view.retained ? "Retry same run" : "Run dry-run pipeline"}
          </button>
        )}
        {view.retained && (
          <button
            className={button}
            type="button"
            disabled={view.busy}
            onClick={() => void controller.inspect()}
          >
            Inspect saved run
          </button>
        )}
        {view.retained && (
          <button
            className={button}
            type="button"
            disabled={view.busy || !canResumeWorkflow(view.result)}
            onClick={() => void controller.resume()}
          >
            Resume after decision
          </button>
        )}

      </div>
      <p className="text-xs text-slate-500">
        Retries keep the saved request identity. Each Client has one immutable run.
        Create a new synthetic Client for another score scenario. Stage labels do not mean teammate agents
        executed.
      </p>
    </form>
  );
};
