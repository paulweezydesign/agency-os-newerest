import type { AgentRun, Brief, RunIdentity, TaskProposal } from "./schemas";

/** Every mutating method is durable and atomic with its audit/checkpoint writes. */
export type AgentRunRepository = {
  inspect(identity: RunIdentity): Promise<AgentRun | null>;
  admit(run: AgentRun): Promise<{ run: AgentRun; admitted: boolean }>;
  createTask(identity: RunIdentity, task: TaskProposal): Promise<AgentRun>;
  complete(identity: RunIdentity, brief: Brief): Promise<AgentRun>;
  markUncertain(identity: RunIdentity): Promise<void>;
};
