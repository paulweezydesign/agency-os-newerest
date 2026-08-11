"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export const CreateDesignReviewForm = ({
  projectId,
}: {
  projectId: string;
}) => {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("https://cdn.example.com/design.png");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch(
      `/api/projects/${projectId}/design-reviews`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, assetUrl }),
      },
    );
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Failed to create design review");
      return;
    }
    router.refresh();
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="text-sm text-slate-700">
        Title
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="text-sm text-slate-700">
        Asset URL
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          value={assetUrl}
          onChange={(e) => setAssetUrl(e.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        className="rounded-md bg-teal-800 px-4 py-2 text-sm text-white hover:bg-teal-700"
      >
        Upload design review
      </button>
    </form>
  );
};
