export type SlackMessage = {
  channel: string;
  text: string;
  metadata?: Record<string, unknown>;
};

export type SlackClient = {
  postMessage: (message: SlackMessage) => Promise<{ ok: true; ts: string }>;
};

export class SlackClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackClientError";
  }
}

export type InMemorySlackClient = SlackClient & {
  messages: SlackMessage[];
  failNext: (error?: string) => void;
  clear: () => void;
};

export const createInMemorySlackClient = (): InMemorySlackClient => {
  const messages: SlackMessage[] = [];
  let nextError: string | null = null;
  let seq = 0;

  return {
    messages,
    failNext: (error = "Slack unavailable") => {
      nextError = error;
    },
    clear: () => {
      messages.length = 0;
      nextError = null;
    },
    postMessage: async (message) => {
      if (nextError) {
        const error = nextError;
        nextError = null;
        throw new SlackClientError(error);
      }

      messages.push(message);
      seq += 1;
      return { ok: true as const, ts: String(seq) };
    },
  };
};
