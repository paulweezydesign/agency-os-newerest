import { randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";
import type { SeedTeammateRole } from "./seed-roster";

type ErrorBody = { error: string };

export type TeammateChatSuccessBody = {
  message: string;
  agentName: string;
  correlationId: string;
};

export type TeammateChatApiResult =
  | { status: 200; body: TeammateChatSuccessBody; stream?: undefined }
  | {
      status: 200;
      body: TeammateChatSuccessBody;
      stream: ReadableStream<Uint8Array>;
    }
  | { status: 400 | 401 | 403; body: ErrorBody; stream?: undefined };

export type TeammateChatAgent = {
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

const requireOperator = (session: AuthSession) => {
  const access = resolveOperatorApiAccess(session);
  switch (access.status) {
    case "unauthenticated":
      return {
        ok: false as const,
        result: {
          status: 401 as const,
          body: { error: "Unauthorized" },
        },
      };
    case "forbidden":
      return {
        ok: false as const,
        result: {
          status: 403 as const,
          body: { error: "Forbidden" },
        },
      };
    case "allow":
      return { ok: true as const, context: access.context };
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
};

const textStreamToReadable = (
  textStream: AsyncIterable<string>,
): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
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

export const handleTeammateChat = async ({
  session,
  body,
  headers,
  agent,
  agentName,
}: {
  session: AuthSession;
  body: unknown;
  headers?: Headers;
  agent: TeammateChatAgent;
  agentName: SeedTeammateRole | string;
}): Promise<TeammateChatApiResult> => {
  const access = requireOperator(session);
  if (!access.ok) {
    return access.result;
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: "Invalid request" } };
  }

  const correlationId =
    headers?.get("x-correlation-id")?.trim() || randomUUID();
  const requestContext = new RequestContext();
  requestContext.set("tenantId", access.context.tenantId);
  requestContext.set("correlationId", correlationId);

  if (parsed.data.stream) {
    const streamed = await agent.stream(parsed.data.message, {
      requestContext,
    });
    return {
      status: 200,
      body: {
        message: "",
        agentName,
        correlationId,
      },
      stream: textStreamToReadable(streamed.textStream),
    };
  }

  const generated = await agent.generate(parsed.data.message, {
    requestContext,
  });

  return {
    status: 200,
    body: {
      message: generated.text,
      agentName,
      correlationId,
    },
  };
};
