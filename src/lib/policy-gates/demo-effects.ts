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

let sharedDemoStore: DemoEffectStore | null = null;

export const getSharedDemoEffectStore = (): DemoEffectStore => {
  sharedDemoStore ??= createDemoEffectStore();
  return sharedDemoStore;
};
