"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import {
  handleDecidePolicyGate,
  handleRequestPolicyGate,
} from "@/lib/policy-gates/policy-gates-api";

export type PolicyGateActionState = {
  error?: string;
  success?: string;
};

export const requestClientEmailGateAction = async (
  _prev: PolicyGateActionState,
  formData: FormData,
): Promise<PolicyGateActionState> => {
  const session = toAuthSession(await auth());
  const service = await getPolicyGateService();
  const result = await handleRequestPolicyGate({
    session,
    service,
    body: {
      actionType: "client_email",
      payload: {
        to: String(formData.get("to") ?? "client@example.com"),
        subject: String(formData.get("subject") ?? "AgencyOS update"),
        body: String(formData.get("body") ?? "Demo gated client email."),
      },
      projectId: String(formData.get("projectId") ?? "").trim() || undefined,
    },
  });

  if (result.status === 201) {
    revalidatePath("/dashboard/policy-gates");
    revalidatePath("/dashboard");
    return { success: "Client email queued for approval." };
  }

  return {
    error: "error" in result.body ? result.body.error : "Unable to request gate",
  };
};

export const decidePolicyGateAction = async (
  gateId: string,
  decision: "approve" | "deny",
): Promise<PolicyGateActionState> => {
  const session = toAuthSession(await auth());
  const service = await getPolicyGateService();
  const result = await handleDecidePolicyGate({
    session,
    service,
    gateId,
    body: { decision },
  });

  if (result.status === 200) {
    revalidatePath("/dashboard/policy-gates");
    revalidatePath("/dashboard");
    return {
      success:
        result.body.status === "approved"
          ? "Gate approved; side effect ran once."
          : "Gate denied; side effect did not run.",
    };
  }

  return {
    error: "error" in result.body ? result.body.error : "Unable to decide gate",
  };
};
