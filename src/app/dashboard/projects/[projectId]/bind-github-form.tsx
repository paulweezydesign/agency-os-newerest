"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  bindGithubRepoAction,
  type GithubBindActionState,
} from "./actions";

const initialState: GithubBindActionState = {};

type BindGithubFormProps = {
  projectId: string;
  githubRepo?: string | null;
};

export const BindGithubForm = ({
  projectId,
  githubRepo,
}: BindGithubFormProps) => {
  const action = bindGithubRepoAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
      <input
        name="githubRepo"
        defaultValue={githubRepo ?? ""}
        placeholder="owner/repo"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Bind GitHub repo"}
      </Button>
      {state.error ? (
        <p className="text-sm text-red-700 sm:basis-full">{state.error}</p>
      ) : null}
    </form>
  );
};
