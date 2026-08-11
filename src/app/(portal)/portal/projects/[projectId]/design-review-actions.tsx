"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const DesignReviewActions = ({
  projectId,
  reviewId,
}: {
  projectId: string;
  reviewId: string;
}) => {
  const router = useRouter();
  const [annotation, setAnnotation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    setError(null);
    const response = await fetch(
      `/api/projects/${projectId}/design-reviews/${reviewId}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, annotation: annotation || undefined }),
      },
    );
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Decision failed");
      return;
    }
    router.refresh();
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        placeholder="Annotation (optional)"
        value={annotation}
        onChange={(e) => setAnnotation(e.target.value)}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md bg-teal-800 px-3 py-1.5 text-sm text-white"
          onClick={() => decide("approve")}
        >
          Approve
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          onClick={() => decide("reject")}
        >
          Reject
        </button>
      </div>
    </div>
  );
};
