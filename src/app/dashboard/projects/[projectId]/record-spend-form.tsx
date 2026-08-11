"use client";

import { useActionState } from "react";
import { recordProjectSpendAction, type SpendActionState } from "./actions";

const initialState: SpendActionState = {};

type RecordSpendFormProps = {
  projectId: string;
};

export const RecordSpendForm = ({ projectId }: RecordSpendFormProps) => {
  const action = recordProjectSpendAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Record spend
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      <button
        className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording…" : "Add spend"}
      </button>
    </form>
  );
};
