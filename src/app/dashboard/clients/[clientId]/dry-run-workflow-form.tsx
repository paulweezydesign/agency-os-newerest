"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export const DryRunWorkflowForm = ({ clientId }: { clientId: string }) => {
  const router = useRouter();
  const [score, setScore] = useState("70");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      // Keep the same request after response loss or a page reload.
      const key = `agencyos:dry-run:v1:${clientId}`;
      const saved = sessionStorage.getItem(key);
      const request = saved ? JSON.parse(saved) as { runId: string; leadScore: number }
        : { runId: crypto.randomUUID(), leadScore: Number(score) };
      sessionStorage.setItem(key, JSON.stringify(request));
      setRunId(request.runId);
      setScore(String(request.leadScore));
      const response = await fetch(`/api/clients/${clientId}/workflow`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
      });
      const result = await response.json() as { error?: string; status?: string };
      setMessage(response.ok ? `Workflow: ${result.status?.replaceAll("_", " ")}.` : result.error ?? "Workflow failed. Retry to recover the same run.");
      if (response.ok) router.refresh();
    } catch {
      setMessage("Workflow request failed. Retry to recover the same run.");
    } finally {
      setPending(false);
    }
  };
  return <form onSubmit={submit} className="flex flex-col gap-3">
    <p className="text-sm text-slate-600">Synthetic .test contacts only. Approval records a dry run with zero external sends. One run per Client; retry resumes the same run.</p>
    <label className="flex flex-col gap-1 text-sm">Lead score (0–100)
      <input type="number" min={0} max={100} step={1} required value={score} disabled={pending || !!runId}
        onChange={(event) => setScore(event.target.value)} className="rounded-md border px-3 py-2" />
    </label>
    <button type="submit" disabled={pending} className="rounded-md bg-teal-800 px-4 py-2 text-white disabled:opacity-60">
      {pending ? "Running…" : runId ? "Resume or check run" : "Run synthetic workflow"}
    </button>
    <p role="status" className="text-sm">{message}</p>
    {runId ? <a className="text-sm text-teal-800 underline" href={`/api/clients/${clientId}/workflow?runId=${runId}`}>View saved run and approval status</a> : null}
    <Link className="text-sm text-teal-800 underline" href="/dashboard/policy-gates">Review human approvals</Link>
  </form>;
};
