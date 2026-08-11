import {
  createInMemorySlackClient,
  type SlackClient,
} from "./slack-client";

let shared: SlackClient | null = null;

/** v1 demo Slack client; swap for HTTP Web API when SLACK_BOT_TOKEN is set. */
export const getSlackClient = (): SlackClient => {
  shared ??= createInMemorySlackClient();
  return shared;
};

export const resetSlackClientForTests = (): void => {
  shared = null;
};
