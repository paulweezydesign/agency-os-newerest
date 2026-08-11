"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type RunPipelineFormProps = {
  clientId: string;
  defaultEmail?: string;
};

export const RunPipelineForm = ({
  clientId,
  defaultEmail = "",
}: RunPipelineFormProps) => {
  const router = useRouter();
  const [leadScore, setLeadScore] = useState("75");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients/${clientId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadScore: Number(leadScore),
          contactEmail: contactEmail || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Pipeline run failed");
        return;
      }

      router.refresh();
    } catch {
      setError("Pipeline run failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Lead score (0–100)
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          type="number"
          min={0}
          max={100}
          value={leadScore}
          onChange={(event) => setLeadScore(event.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Contact email (gated before Resend)
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <p className="text-xs text-slate-500">
          ≥70 onboard · ≥40 nurture · &lt;40 disqualify. Emails queue for
          approval.
        </p>
      )}
      <button
        className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "Running…" : "Run client pipeline"}
      </button>
    </form>
  );
};
