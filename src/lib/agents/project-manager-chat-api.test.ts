import { describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import {
  handleProjectManagerChat,
  type ProjectManagerChatAgent,
} from "./project-manager-chat-api";

const operatorSession: AuthSession = {
  user: {
    id: "user-operator",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

const clientRoleSession: AuthSession = {
  user: {
    id: "user-client",
    role: "client",
    tenantId: "tenant-default",
  },
};

const createMockAgent = (): ProjectManagerChatAgent => ({
  generate: vi.fn(async () => ({ text: "I'll list the open Tasks." })),
  stream: vi.fn(async () => ({
    textStream: (async function* () {
      yield "Streaming ";
      yield "reply";
    })(),
  })),
});

describe("handleProjectManagerChat", () => {
  it("rejects unauthenticated and client-role access", async () => {
    const agent = createMockAgent();

    const unauth = await handleProjectManagerChat({
      session: null,
      body: { message: "List tasks" },
      agent,
    });
    expect(unauth).toMatchObject({
      status: 401,
      body: { error: "Unauthorized" },
    });

    const forbidden = await handleProjectManagerChat({
      session: clientRoleSession,
      body: { message: "List tasks" },
      agent,
    });
    expect(forbidden).toMatchObject({
      status: 403,
      body: { error: "Forbidden" },
    });
    expect(agent.generate).not.toHaveBeenCalled();
  });

  it("returns a non-streaming chat response from the agent", async () => {
    const agent = createMockAgent();

    const result = await handleProjectManagerChat({
      session: operatorSession,
      body: { message: "What tasks are open?" },
      headers: new Headers({ "x-correlation-id": "corr-chat-1" }),
      agent,
    });

    expect(result).toMatchObject({
      status: 200,
      body: {
        message: "I'll list the open Tasks.",
        agentName: "project-manager",
        correlationId: "corr-chat-1",
      },
    });
    expect(agent.generate).toHaveBeenCalledOnce();
    expect(agent.stream).not.toHaveBeenCalled();
  });

  it("streams a chat response when stream is requested", async () => {
    const agent = createMockAgent();

    const result = await handleProjectManagerChat({
      session: operatorSession,
      body: { message: "Create a research task", stream: true },
      headers: new Headers({ "x-correlation-id": "corr-chat-2" }),
      agent,
    });

    expect(result.status).toBe(200);
    expect(result).toHaveProperty("body");
    if (!("stream" in result) || !result.stream) {
      throw new Error("expected streaming result");
    }

    const chunks: string[] = [];
    const reader = result.stream.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    expect(chunks.join("")).toBe("Streaming reply");
    expect(agent.stream).toHaveBeenCalledOnce();
    expect(agent.generate).not.toHaveBeenCalled();
  });

  it("rejects empty messages", async () => {
    const agent = createMockAgent();
    const result = await handleProjectManagerChat({
      session: operatorSession,
      body: { message: "   " },
      agent,
    });
    expect(result).toMatchObject({
      status: 400,
      body: { error: "Invalid request" },
    });
  });
});
