"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}`;

export const ProjectManagerChat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sendMessage = () => {
    const message = input.trim();
    if (!message || isPending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: message,
    };
    const assistantId = createId();

    setInput("");
    setError(null);
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    startTransition(async () => {
      try {
        const response = await fetch("/api/agents/project-manager/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-correlation-id": createId(),
          },
          body: JSON.stringify({ message, stream: true }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Chat request failed");
        }

        if (!response.body) {
          throw new Error("No response stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          assistantText += decoder.decode(value, { stream: true });
          const snapshot = assistantText;
          setMessages((prev) =>
            prev.map((entry) =>
              entry.id === assistantId
                ? { ...entry, content: snapshot }
                : entry,
            ),
          );
        }
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : "Chat request failed";
        setError(messageText);
        setMessages((prev) =>
          prev.filter((entry) => entry.id !== assistantId),
        );
      }
    });
  };

  return (
    <section className="flex min-h-[28rem] flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ask the Project Manager to list or create Tasks. It orchestrates
            only — it will not execute deliverable work.
          </p>
        ) : (
          messages.map((entry) => (
            <div
              key={entry.id}
              className={
                entry.role === "user"
                  ? "ml-8 rounded-lg bg-teal-50 px-3 py-2 text-sm text-slate-900"
                  : "mr-8 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800"
              }
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {entry.role === "user" ? "You" : "Project Manager"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">
                {entry.content || (isPending ? "…" : "")}
              </p>
            </div>
          ))
        )}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message the Project Manager…"
          className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-700"
          disabled={isPending}
        />
        <Button type="submit" disabled={isPending || input.trim().length === 0}>
          {isPending ? "Sending…" : "Send"}
        </Button>
      </form>
    </section>
  );
};
