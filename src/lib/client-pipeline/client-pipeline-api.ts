import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import type { ClientPipelineService } from "./client-pipeline-service";
import { runClientPipelineInputSchema } from "./schemas";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200; body: T }
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

export const handleRunClientPipeline = async (input: {
  session: AuthSession;
  service: ClientPipelineService;
  clientId: string;
  body: unknown;
}): Promise<ApiResult<Awaited<ReturnType<ClientPipelineService["run"]>>>> => {
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
    const parsed = runClientPipelineInputSchema.parse(input.body);
    const result = await input.service.run({
      tenantId: access.context.tenantId,
      clientId: input.clientId,
      leadScore: parsed.leadScore,
      contactEmail: parsed.contactEmail,
      requestedBy: access.context.userId,
      correlationId: crypto.randomUUID(),
    });
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return { status: 404, body: { error: "Client not found" } };
    }
    throw error;
  }
};
