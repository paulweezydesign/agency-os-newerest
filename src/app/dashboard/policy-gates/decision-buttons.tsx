"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { decidePolicyGateAction } from "./actions";

export const PolicyGateDecisionButtons = ({ gateId }: { gateId: string }) => {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDecide = (decision: "approve" | "deny") => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await decidePolicyGateAction(gateId, decision);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Updated.");
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => onDecide("approve")}
        >
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onDecide("deny")}
        >
          Deny
        </Button>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {message ? <p className="text-xs text-teal-800">{message}</p> : null}
    </div>
  );
};
