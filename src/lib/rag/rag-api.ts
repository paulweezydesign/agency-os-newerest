import { ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import type { KnowledgeBase, KnowledgeDocument } from "./knowledge-base";
import {
  ingestDocumentInputSchema,
  queryKnowledgeInputSchema,
  type KnowledgeQueryResult,
} from "./schemas";

type ErrorBody = { error: string };

export type ApiResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 403; body: ErrorBody };

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

export const handleIngestDocument = async (input: {
  session: AuthSession;
  knowledgeBase: KnowledgeBase;
  body: unknown;
}): Promise<
  ApiResult<Pick<KnowledgeDocument, "id" | "sourceId" | "title">>
> => {
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
    const parsed = ingestDocumentInputSchema.parse(input.body);
    const doc = await input.knowledgeBase.ingest(
      access.context.tenantId,
      parsed,
    );
    return {
      status: 201,
      body: { id: doc.id, sourceId: doc.sourceId, title: doc.title },
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    throw error;
  }
};

export const handleQueryKnowledge = async (input: {
  session: AuthSession;
  knowledgeBase: KnowledgeBase;
  body: unknown;
}): Promise<ApiResult<KnowledgeQueryResult>> => {
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
    const parsed = queryKnowledgeInputSchema.parse(input.body);
    const result = await input.knowledgeBase.query(
      access.context.tenantId,
      parsed,
    );
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "Invalid request" } };
    }
    throw error;
  }
};
