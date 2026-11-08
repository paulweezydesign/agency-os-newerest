import mongoose, { type ClientSession } from "mongoose";
import { getTaskModel } from "@/lib/tasks/task-model";
import { getProjectModel } from "@/lib/projects/project-model";
import { getProjectArtifactModel } from "@/lib/project-artifacts/artifact-model";
import { getAgentActionLogModel } from "@/lib/agent-action-logs/agent-action-log-model";
import { getAgentRunModel } from "./agent-run-model";
import type { AgentRunRepository } from "./agent-run-repository";
import { AgentRunConflict, type AgentRun, type RunIdentity } from "./schemas";

const identityFilter = ({ tenantId, projectId, runId }: RunIdentity) => ({ tenantId, projectId, runId });
const toRun = (record: AgentRun): AgentRun => ({
  tenantId: record.tenantId, projectId: record.projectId, runId: record.runId,
  actorId: record.actorId, fixtureId: record.fixtureId, modelId: record.modelId,
  state: record.state, taskId: record.taskId, artifactId: record.artifactId,
  taskTitle: record.taskTitle, taskDescription: record.taskDescription,
});

// No withTransaction callback retries, and no model/provider calls inside transactions.
// A commit with an uncertain outcome is reconciled by inspect, never replayed.
const transaction = async <T>(fn: (session: ClientSession) => Promise<T>): Promise<T> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority", j: true } });
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction().catch(() => undefined);
    throw error;
  } finally {
    await session.endSession();
  }
};

export const createMongooseAgentRunRepository = (): AgentRunRepository => {
  const runs = getAgentRunModel();
  const inspect: AgentRunRepository["inspect"] = async identity => {
    const run = await runs.findOne(identityFilter(identity)).read("primary").readConcern("majority").exec();
    return run ? toRun(run) : null;
  };
  const audit = async (session: ClientSession, run: AgentRun, agentName: string, toolName: string, output: unknown) => {
    await new (getAgentActionLogModel())({
      tenantId: run.tenantId, projectId: run.projectId, taskId: run.taskId ?? undefined,
      agentName, toolName, input: { fixtureId: run.fixtureId, modelId: run.modelId }, output,
      status: "success", correlationId: `agent-run:${run.runId}`,
    }).save({ session });
  };
  return {
    inspect,
    admit: async requested => {
      // Ensure unique indexes exist before allowing concurrency. No destructive syncIndexes.
      await runs.init();
      // Explicit creation is required even when global autoIndex is disabled.
      await runs.createIndexes();
      const existing = await inspect(requested);
      if (existing) {
        if (existing.fixtureId !== requested.fixtureId || existing.modelId !== requested.modelId) {
          throw new AgentRunConflict("Run input differs from its immutable admission");
        }
        return { run: existing, admitted: false };
      }
      try {
        return await transaction(async session => {
          const project = await getProjectModel().findOne({
            _id: requested.projectId, tenantId: requested.tenantId,
          }).session(session).exec();
          if (!project || project.githubRepo) throw new AgentRunConflict("Synthetic Project unavailable");
          const [created] = await runs.create([requested], { session });
          await audit(session, requested, "project-manager", "agent-run.admit", { state: "claimed" });
          return { run: toRun(created!), admitted: true };
        });
      } catch (error) {
        // Includes a duplicate concurrent admission and a lost commit response.
        // Inspect does not turn a previously claimed run into permission to execute.
        const existing = await inspect(requested);
        if (existing && existing.fixtureId === requested.fixtureId && existing.modelId === requested.modelId) {
          return { run: existing, admitted: false };
        }
        if (error && typeof error === "object" && "code" in error && error.code === 11000) {
          throw new AgentRunConflict("Project already has an immutable agent run");
        }
        throw error;
      }
    },
    createTask: async (identity, proposal) => transaction(async session => {
      const run = await runs.findOne(identityFilter(identity)).session(session).exec();
      if (!run) throw new AgentRunConflict("Run not found");
      if (run.state === "task_created" && run.taskId) {
        if (run.taskTitle !== proposal.title || run.taskDescription !== proposal.description) {
          throw new AgentRunConflict("Assigned Task scope is immutable");
        }
        return toRun(run);
      }
      if (run.state !== "claimed") throw new AgentRunConflict("Run is not claimable");
      const [task] = await getTaskModel().create([{
        tenantId: run.tenantId, projectId: run.projectId, ...proposal,
        assignee: "tech-lead", status: "in_progress", mondayItemId: null, linearIssueId: null,
      }], { session });
      run.taskId = task!._id.toString();
      run.taskTitle = proposal.title;
      run.taskDescription = proposal.description;
      run.state = "task_created";
      await run.save({ session });
      await audit(session, run, "project-manager", "createTask", { taskId: run.taskId, ...proposal });
      return toRun(run);
    }),
    complete: async (identity, brief) => transaction(async session => {
      const run = await runs.findOne(identityFilter(identity)).session(session).exec();
      if (!run) throw new AgentRunConflict("Run not found");
      if (run.state === "completed") return toRun(run);
      if (run.state !== "task_created" || !run.taskId) throw new AgentRunConflict("No assigned Task");
      const updated = await getTaskModel().updateOne({
        _id: run.taskId, tenantId: run.tenantId, projectId: run.projectId,
        assignee: "tech-lead", status: "in_progress", mondayItemId: null, linearIssueId: null,
        title: run.taskTitle, description: run.taskDescription,
      }, { $set: { status: "done" } }, { session });
      if (updated.modifiedCount !== 1) throw new AgentRunConflict("Assigned Task changed");
      const [artifact] = await getProjectArtifactModel().create([{
        tenantId: run.tenantId, projectId: run.projectId, kind: "brief", ...brief,
      }], { session });
      run.artifactId = artifact!._id.toString();
      run.state = "completed";
      await run.save({ session });
      await audit(session, run, "tech-lead", "createProjectBrief", { artifactId: run.artifactId, taskId: run.taskId });
      return toRun(run);
    }),
    markUncertain: async identity => transaction(async session => {
      const run = await runs.findOne(identityFilter(identity)).session(session).exec();
      if (!run || run.state === "completed" || run.state === "uncertain") return;
      run.state = "uncertain";
      await run.save({ session });
      await new (getAgentActionLogModel())({
        tenantId: run.tenantId, projectId: run.projectId, taskId: run.taskId ?? undefined,
        agentName: "project-manager", toolName: "agent-run.uncertain",
        input: { runId: run.runId }, output: { reconciliationRequired: true },
        status: "error", correlationId: `agent-run:${run.runId}`,
      }).save({ session });
    }),
  };
};
