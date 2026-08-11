"use client";

import { useTransition } from "react";
import { sendSowAction } from "./actions";

type SendSowButtonProps = {
  projectId: string;
  artifactId: string;
};

export const SendSowButton = ({
  projectId,
  artifactId,
}: SendSowButtonProps) => {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="rounded-md border border-teal-800 px-3 py-1.5 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:opacity-60"
      disabled={pending}
      type="button"
      onClick={() => {
        startTransition(async () => {
          await sendSowAction(projectId, artifactId);
        });
      }}
    >
      {pending ? "Queuing…" : "Send to Client (policy gate)"}
    </button>
  );
};
