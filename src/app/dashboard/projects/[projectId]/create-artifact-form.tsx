"use client";

import { useActionState } from "react";
import { createArtifactAction, type ArtifactActionState } from "./actions";

const initialState: ArtifactActionState = {};

type CreateArtifactFormProps = {
  projectId: string;
};

export const CreateArtifactForm = ({ projectId }: CreateArtifactFormProps) => {
  const action = createArtifactAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Kind
        <select
          className="rounded-md border border-slate-300 px-3 py-2"
          defaultValue="brief"
          name="kind"
          required
        >
          <option value="brief">Project brief</option>
          <option value="sow">SOW</option>
          <option value="mvp_scaffold">MVP scaffold</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Title
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="title"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Body
        <textarea
          className="rounded-md border border-slate-300 px-3 py-2"
          name="body"
          required
          rows={4}
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      <button
        className="w-fit rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Create artifact"}
      </button>
    </form>
  );
};
