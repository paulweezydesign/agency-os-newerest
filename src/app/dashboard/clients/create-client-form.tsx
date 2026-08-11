"use client";

import { useActionState } from "react";
import {
  createClientAction,
  type CreateClientActionState,
} from "./actions";

const initialState: CreateClientActionState = {};

export const CreateClientForm = () => {
  const [state, formAction, pending] = useActionState(
    createClientAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-slate-700">
        Client name
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="name"
          type="text"
          placeholder="Acme Co"
          required
          disabled={pending}
        />
      </label>
      <div className="flex items-end">
        <button
          className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending ? "Creating…" : "Create client"}
        </button>
      </div>
      {state.error ? (
        <p className="basis-full text-sm text-red-700">{state.error}</p>
      ) : null}
    </form>
  );
};
