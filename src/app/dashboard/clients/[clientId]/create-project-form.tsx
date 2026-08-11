"use client";

import { useActionState } from "react";
import {
  createProjectAction,
  type CreateProjectActionState,
} from "./actions";

const initialState: CreateProjectActionState = {};

type CreateProjectFormProps = {
  clientId: string;
};

export const CreateProjectForm = ({ clientId }: CreateProjectFormProps) => {
  const action = createProjectAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
        Name
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="name"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Budget
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="budget"
          type="number"
          min={0}
          step="0.01"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Timeline start
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            name="timelineStart"
            type="date"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Timeline end
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            name="timelineEnd"
            type="date"
            required
          />
        </label>
      </div>
      {state.error ? (
        <p className="text-sm text-red-700 md:col-span-2">{state.error}</p>
      ) : null}
      <div className="md:col-span-2">
        <button
          className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
};
