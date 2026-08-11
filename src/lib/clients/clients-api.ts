import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import type { ClientService } from "./client-service";
import { createClientInputSchema, type Client } from "./schemas";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 403 | 404; body: ErrorBody };

type HandlerDeps = {
  session: AuthSession;
  service: ClientService;
};

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

export const handleCreateClient = async ({
  session,
  service,
  body,
}: HandlerDeps & { body: unknown }): Promise<ApiResult<Client>> => {
  const access = resolveOperatorApiAccess(session);

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
    const parsed = createClientInputSchema.parse(body);
    const created = await service.create({
      tenantId: access.context.tenantId,
      name: parsed.name,
    });

    return { status: 201, body: created };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }

    throw error;
  }
};

export const handleListClients = async ({
  session,
  service,
}: HandlerDeps): Promise<ApiResult<Client[]>> => {
  const access = resolveOperatorApiAccess(session);

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

  const clients = await service.list(access.context.tenantId);
  return { status: 200, body: clients };
};

export const handleGetClient = async ({
  session,
  service,
  clientId,
}: HandlerDeps & { clientId: string }): Promise<ApiResult<Client>> => {
  const access = resolveOperatorApiAccess(session);

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

  const client = await service.get(access.context.tenantId, clientId);

  if (!client) {
    return { status: 404, body: { error: "Not found" } };
  }

  return { status: 200, body: client };
};
