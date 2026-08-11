import { randomUUID } from "node:crypto";
import { ZodError, z } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import {
  PolicyGateNotFoundError,
  PolicyGateNotPendingError,
  type PolicyGateService,
} from "./policy-gate-service";
import {
  policyGateActionTypeSchema,
  policyGatePayloadSchema,
  type PolicyGate,
} from "./schemas";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 403 | 404 | 409; body: ErrorBody };

type HandlerDeps = {
  session: AuthSession;
  service: PolicyGateService;
};

const requestBodySchema = z.object({
  actionType: policyGateActionTypeSchema,
  payload: policyGatePayloadSchema.default({}),
  projectId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  actorName: z.string().min(1).optional(),
});

const decisionBodySchema = z.object({
  decision: z.enum(["approve", "deny"]),
  correlationId: z.string().min(1).optional(),
  actorName: z.string().min(1).optional(),
});

const toAuthError = (
  status: "unauthenticated" | "forbidden",
): ApiResult<never> => {
  switch (status) {
    case "unauthenticated":
      return { status: 401, body: { error: "Unauthorized" } };
    case "forbidden":
      return { status: 403, body: { error: "Forbidden" } };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

const requireOperator = (session: AuthSession) => {
  const access = resolveOperatorApiAccess(session);

  switch (access.status) {
    case "unauthenticated":
    case "forbidden":
      return { ok: false as const, result: toAuthError(access.status) };
    case "allow":
      return { ok: true as const, context: access.context };
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
};

const actorFromSession = (
  context: { role: string; userId: string },
  override?: string,
) => override?.trim() || `${context.role}:${context.userId}`;

export const handleListPolicyGates = async ({
  session,
  service,
  pendingOnly = true,
}: HandlerDeps & { pendingOnly?: boolean }): Promise<
  ApiResult<PolicyGate[]>
> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const gates = pendingOnly
    ? await service.listPending(access.context.tenantId)
    : await service.list(access.context.tenantId);

  return { status: 200, body: gates };
};

export const handleRequestPolicyGate = async ({
  session,
  service,
  body,
}: HandlerDeps & { body: unknown }): Promise<ApiResult<PolicyGate>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = requestBodySchema.parse(body ?? {});
    const correlationId = parsed.correlationId?.trim() || randomUUID();
    const gate = await service.request({
      tenantId: access.context.tenantId,
      actionType: parsed.actionType,
      payload: parsed.payload,
      projectId: parsed.projectId,
      correlationId,
      requestedBy: actorFromSession(access.context, parsed.actorName),
    });

    return { status: 201, body: gate };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    throw error;
  }
};

export const handleDecidePolicyGate = async ({
  session,
  service,
  gateId,
  body,
}: HandlerDeps & {
  gateId: string;
  body: unknown;
}): Promise<ApiResult<PolicyGate>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  try {
    const parsed = decisionBodySchema.parse(body ?? {});
    const correlationId = parsed.correlationId?.trim() || randomUUID();
    const decidedBy = actorFromSession(access.context, parsed.actorName);

    const decide = async () => {
      switch (parsed.decision) {
        case "approve":
          return service.approve({
            tenantId: access.context.tenantId,
            gateId,
            decidedBy,
            correlationId,
          });
        case "deny":
          return service.deny({
            tenantId: access.context.tenantId,
            gateId,
            decidedBy,
            correlationId,
          });
        default: {
          const _exhaustive: never = parsed.decision;
          return _exhaustive;
        }
      }
    };

    const gate = await decide();
    return { status: 200, body: gate };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    if (error instanceof PolicyGateNotFoundError) {
      return { status: 404, body: { error: "Policy gate not found" } };
    }
    if (error instanceof PolicyGateNotPendingError) {
      return { status: 409, body: { error: "Policy gate already decided" } };
    }
    throw error;
  }
};
