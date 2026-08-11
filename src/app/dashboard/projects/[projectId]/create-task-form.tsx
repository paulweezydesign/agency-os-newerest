"use client";

import { useActionState } from "react";
import { createTaskAction, type TaskActionState } from "./actions";

const initialState: TaskActionState = {};

type CreateTaskFormProps = {
  projectId: string;
};

export const CreateTaskForm = ({ projectId }: CreateTaskFormProps) => {
  const action = createTaskAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Title
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="title"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Description
        <textarea
          className="rounded-md border border-slate-300 px-3 py-2"
          name="description"
          rows={2}
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
        {pending ? "Creating…" : "Add task"}
      </button>
    </form>
  );
};
