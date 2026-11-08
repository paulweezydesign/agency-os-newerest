import { z } from "zod";

export const FIXTURE = Object.freeze({
  id: "synthetic-brief-v1" as const,
  prompt: "Fictional exercise only: outline an accessible one-page website for Example Studio, a fictional design agency. No real people, contacts, prices, external research, code execution, or delivery. Produce an internal planning brief.",
});
export const taskProposalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
}).strict();
export const briefSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(16000),
}).strict();
export const startRunSchema = z.object({
  runId: z.uuid(),
  fixtureId: z.literal(FIXTURE.id),
}).strict();
export type TaskProposal = z.infer<typeof taskProposalSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type RunIdentity = { tenantId: string; projectId: string; runId: string };
export type AgentRun = RunIdentity & {
  actorId: string;
  fixtureId: typeof FIXTURE.id;
  modelId: string;
  state: "claimed" | "task_created" | "completed" | "uncertain";
  taskId: string | null;
  taskTitle: string | null;
  taskDescription: string | null;
  artifactId: string | null;
};
export class AgentRunConflict extends Error {}
export class AgentRunUnavailable extends Error {}
