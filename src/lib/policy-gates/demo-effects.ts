import type { ResendClient } from "@/lib/email/resend-client";
import type { PolicyGateEffectRunner } from "./policy-gate-service";
import type { PolicyGateActionType } from "./schemas";

export type DemoEffectRecord = {
  actionType: PolicyGateActionType;
  payload: Record<string, unknown>;
  projectId?: string;
  tenantId: string;
  ranAt: string;
};

export type DemoEffectStore = {
  records: DemoEffectRecord[];
  runCount: () => number;
  clear: () => void;
};

export const createDemoEffectStore = (): DemoEffectStore => {
  const records: DemoEffectRecord[] = [];

  return {
    records,
    runCount: () => records.length,
    clear: () => {
      records.length = 0;
    },
  };
};

const readEmailPayload = (payload: Record<string, unknown>) => {
  const to = payload.to;
  const subject = payload.subject;
  const body = payload.body;
  const clientId = payload.clientId;

  if (typeof to !== "string" || to.length === 0) {
    throw new Error("client_email payload.to is required");
  }
  if (typeof subject !== "string") {
    throw new Error("client_email payload.subject is required");
  }
  if (typeof body !== "string") {
    throw new Error("client_email payload.body is required");
  }

  return {
    to,
    subject,
    body,
    clientId: typeof clientId === "string" ? clientId : undefined,
  };
};

export const createDemoEffectRunner = (
  store: DemoEffectStore,
): PolicyGateEffectRunner => {
  return async ({ actionType, payload, projectId, tenantId }) => {
    const record: DemoEffectRecord = {
      actionType,
      payload,
      projectId,
      tenantId,
      ranAt: new Date().toISOString(),
    };
    store.records.push(record);

    switch (actionType) {
      case "client_email":
        return { effectRan: true, kind: "client_email", record };
      case "sow_send":
        return { effectRan: true, kind: "sow_send", record };
      case "invoice_or_deposit":
        return { effectRan: true, kind: "invoice_or_deposit", record };
      default: {
        const _exhaustive: never = actionType;
        return _exhaustive;
      }
    }
  };
};

/** Runs Resend only for client_email; other actions stay demo-recorded. */
export const createResendAwareEffectRunner = (
  store: DemoEffectStore,
  resend: ResendClient,
): PolicyGateEffectRunner => {
  const demo = createDemoEffectRunner(store);

  return async (args) => {
    if (args.actionType === "client_email") {
      const email = readEmailPayload(args.payload);
      await resend.sendEmail(email);
    }

    return demo(args);
  };
};

let sharedDemoStore: DemoEffectStore | null = null;

export const getSharedDemoEffectStore = (): DemoEffectStore => {
  sharedDemoStore ??= createDemoEffectStore();
  return sharedDemoStore;
};
