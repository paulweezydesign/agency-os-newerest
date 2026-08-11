import { randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import { PROJECT_MANAGER_AGENT_NAME } from "@/mastra/tools/task-tools";

type ErrorBody = { error: string };

export type ChatSuccessBody = {
  message: string;
  agentName: typeof PROJECT_MANAGER_AGENT_NAME;
  correlationId: string;
};

export type ApiResult<T> =
  | { status: 200; body: T; stream?: undefined }
  | { status: 200; body: ChatSuccessBody; stream: ReadableStream<Uint8Array> }
  | { status: 400 | 401 | 403; body: ErrorBody; stream?: undefined };

export type ProjectManagerChatAgent = {
  generate: (
    message: string,
    options: { requestContext: RequestContext },
  ) => Promise<{ text: string }>;
  stream: (
    message: string,
    options: { requestContext: RequestContext },
  ) => Promise<{ textStream: AsyncIterable<string> }>;
};

const chatBodySchema = z.object({
  message: z.string().trim().min(1, "message is required"),
  stream: z.boolean().optional(),
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

const readCorrelationId = (headers?: Headers): string => {
  const fromHeader = headers?.get("x-correlation-id")?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
};

const buildRequestContext = (tenantId: string, correlationId: string) => {
  const requestContext = new RequestContext();
  requestContext.set("tenantId", tenantId);
  requestContext.set("correlationId", correlationId);
  return requestContext;
};

const textStreamToReadable = (
  textStream: AsyncIterable<string>,
): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
        for await (const chunk of textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
};

export const handleProjectManagerChat = async ({
  session,
  body,
  headers,
  agent,
}: {
  session: AuthSession;
  body: unknown;
  headers?: Headers;
  agent: ProjectManagerChatAgent;
}): Promise<ApiResult<ChatSuccessBody>> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: "Invalid request" } };
  }

  const correlationId = readCorrelationId(headers);
  const requestContext = buildRequestContext(
    access.context.tenantId,
    correlationId,
  );
  const { message, stream } = parsed.data;

  if (stream) {
    const agentStream = await agent.stream(message, { requestContext });
    return {
      status: 200,
      body: {
        message: "",
        agentName: PROJECT_MANAGER_AGENT_NAME,
        correlationId,
      },
      stream: textStreamToReadable(agentStream.textStream),
    };
  }

  const generated = await agent.generate(message, { requestContext });
  return {
    status: 200,
    body: {
      message: generated.text,
      agentName: PROJECT_MANAGER_AGENT_NAME,
      correlationId,
    },
  };
};
