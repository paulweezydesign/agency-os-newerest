"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  requestClientEmailGateAction,
  type PolicyGateActionState,
} from "./actions";

const initialState: PolicyGateActionState = {};

export const RequestClientEmailForm = () => {
  const [state, action, pending] = useActionState(
    requestClientEmailGateAction,
    initialState,
  );

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="text-slate-600">To</span>
        <input
          name="to"
          defaultValue="client@example.com"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-slate-600">Subject</span>
        <input
          name="subject"
          defaultValue="AgencyOS update"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="text-slate-600">Body</span>
        <textarea
          name="body"
          defaultValue="Demo gated client email."
          rows={3}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Queuing…" : "Request client email"}
        </Button>
        {state.error ? (
          <p className="mt-2 text-sm text-red-700">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="mt-2 text-sm text-teal-800">{state.success}</p>
        ) : null}
      </div>
    </form>
  );
};
