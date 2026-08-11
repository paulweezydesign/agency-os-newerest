import { ZodError, z } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import type { PolicyGate } from "@/lib/policy-gates/schemas";
import { ProjectNotFoundError } from "@/lib/projects/project-service";
import type { DepositService } from "./deposit-service";

const startDepositSchema = z.object({
  amount: z.coerce.number().positive(),
});

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 201; body: T }
  | { status: 400 | 401 | 403 | 404; body: ErrorBody };

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

export const handleStartDeposit = async (input: {
  session: AuthSession;
  deposits: DepositService;
  projectId: string;
  body: unknown;
}): Promise<ApiResult<PolicyGate>> => {
  const access = resolveOperatorApiAccess(input.session);

  switch (access.status) {
    case "unauthenticated":
    case "forbidden":
      return toAuthError(access.status);
    case "allow":
      break;
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }

  try {
    const parsed = startDepositSchema.parse(input.body);
    const gate = await input.deposits.requestDeposit({
      tenantId: access.context.tenantId,
      projectId: input.projectId,
      amount: parsed.amount,
      requestedBy: access.context.userId,
      correlationId: crypto.randomUUID(),
    });
    return { status: 201, body: gate };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    if (error instanceof ProjectNotFoundError) {
      return { status: 404, body: { error: "Project not found" } };
    }
    throw error;
  }
};
