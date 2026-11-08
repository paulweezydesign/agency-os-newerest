import type { AgentRunRepository } from "./agent-run-repository";
import {
  AgentRunConflict, FIXTURE, briefSchema, startRunSchema, taskProposalSchema,
  type AgentRun, type RunIdentity, type TaskProposal,
} from "./schemas";

export type BoundedGenerator = {
  modelId: string;
  orchestrate(prompt: string, createTask: (input: unknown) => Promise<{ taskId: string }>, signal: AbortSignal): Promise<void>;
  produceBrief(task: TaskProposal, signal: AbortSignal): Promise<unknown>;
};

// The timeout races even injected adapters which fail to honor AbortSignal.
// Late responses can never trigger persistence; claimed work is never replayed.
const bounded = async (call: (signal: AbortSignal) => Promise<unknown>) => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => call(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Model invocation deadline exceeded"));
        }, 30_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const createAgentRunService = (
  repository: AgentRunRepository,
  generator: BoundedGenerator,
) => ({
  inspect: (identity: RunIdentity) => repository.inspect(identity),
  start: async (input: RunIdentity & { actorId: string; fixtureId: string }): Promise<AgentRun> => {
    startRunSchema.parse({ runId: input.runId, fixtureId: input.fixtureId });
    if (!generator.modelId.trim()) throw new AgentRunConflict("Explicit model required");
    const admission = await repository.admit({
      ...input, fixtureId: FIXTURE.id, modelId: generator.modelId,
      state: "claimed", taskId: null, taskTitle: null, taskDescription: null, artifactId: null,
    });
    if (!admission.admitted) return admission.run;
    try {
      let task: TaskProposal | undefined;
      let taskCommit: Promise<{ taskId: string }> | undefined;
      let acceptsToolCalls = true;
      let toolViolation = false;
      try {
        await bounded(signal => generator.orchestrate(FIXTURE.prompt, async proposal => {
          if (!acceptsToolCalls || signal.aborted) throw new AgentRunConflict("Invocation is closed");
          const validation = taskProposalSchema.safeParse(proposal);
          if (!validation.success) {
            toolViolation = true;
            throw new AgentRunConflict("Invalid Task input");
          }
          const parsed = validation.data;
          if (task && JSON.stringify(task) !== JSON.stringify(parsed)) {
            toolViolation = true;
            throw new AgentRunConflict("Exactly one immutable Task is permitted");
          }
          task = parsed;
          taskCommit ??= repository.createTask(input, parsed).then(run => {
            if (!run.taskId) throw new AgentRunConflict("Task was not committed");
            return { taskId: run.taskId };
          });
          return taskCommit;
        }, signal));
      } finally {
        acceptsToolCalls = false;
      }
      if (toolViolation) throw new AgentRunConflict("Task tool rejected an operation");
      if (!task || !taskCommit) throw new AgentRunConflict("Project Manager did not create a Task");
      await taskCommit;
      const brief = briefSchema.parse(await bounded(signal => generator.produceBrief(task!, signal)));
      return await repository.complete(input, brief);
    } catch {
      // Do not overwrite a possibly committed completion or expose provider errors/secrets.
      await repository.markUncertain(input);
      const run = await repository.inspect(input);
      if (!run) throw new AgentRunConflict("Run requires reconciliation");
      return run;
    }
  },
});
export type AgentRunService = ReturnType<typeof createAgentRunService>;
