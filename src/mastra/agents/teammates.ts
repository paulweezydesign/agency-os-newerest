import { Agent } from "@mastra/core/agent";
import type { AgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import {
  SEED_TEAMMATE_ROLES,
  isSeedTeammateRole,
  teammateSafetyRules,
  type SeedTeammateRole,
} from "@/lib/agents/seed-roster";
import {
  createResearchTools,
  type ResearchToolDeps,
} from "../tools/search-tools";
import { createTeammateTools } from "../tools/teammate-tools";

export type TeammateAgentDeps = {
  actionLogs: AgentActionLogRepository;
  research?: Omit<ResearchToolDeps, "actionLogs">;
};

export type SpawnedTeammateOptions = {
  id: string;
  specialization: string;
  justification: string;
};

const displayNameForRole = (role: SeedTeammateRole): string => {
  switch (role) {
    case "tech-lead":
      return "Tech Lead";
    case "design":
      return "Design";
    case "research":
      return "Research";
    case "frontend":
      return "Frontend";
    case "backend":
      return "Backend";
    case "qa":
      return "QA";
    case "prospector":
      return "Prospector";
    case "nurture":
      return "Nurture";
    case "onboarding":
      return "Onboarding";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
};

const buildTeammateInstructions = (role: SeedTeammateRole): string => {
  const researchHint =
    role === "research"
      ? `
- exaSearch: search the web via Exa
- ingestDocument: store knowledge for later RAG queries
- queryKnowledge: answer with source attribution from ingested docs`
      : "";

  return `You are the ${displayNameForRole(role)} teammate agent for AgencyOS.

You execute assigned work under Project Manager delegation only.
Safety rules: ${teammateSafetyRules(role)}

Operate through tools only:
- reportStatus: report progress, completion, or blockers on assigned work${researchHint}

Never invent client outreach or financial actions. Respect policy gates for client-facing and money work. Prefer short, actionable replies.`;
};

export const createTeammateAgent = (
  role: SeedTeammateRole,
  deps: TeammateAgentDeps,
) => {
  const baseTools = createTeammateTools({
    actionLogs: deps.actionLogs,
    agentName: role,
  });

  const tools =
    role === "research" && deps.research
      ? {
          ...baseTools,
          ...createResearchTools({
            actionLogs: deps.actionLogs,
            ...deps.research,
          }),
        }
      : baseTools;

  return new Agent({
    id: role,
    name: displayNameForRole(role),
    instructions: buildTeammateInstructions(role),
    model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini",
    tools,
  });
};

export type TeammateAgent = ReturnType<typeof createTeammateAgent>;

/** Alias for callers that prefer the seed-specific name. */
export const createSeedTeammateAgent = createTeammateAgent;

export const createAllSeedTeammateAgents = (deps: TeammateAgentDeps) =>
  Object.fromEntries(
    SEED_TEAMMATE_ROLES.map((role) => [role, createTeammateAgent(role, deps)]),
  ) as Record<SeedTeammateRole, TeammateAgent>;

/** Alias used by the Mastra app registry. */
export const createSeedTeammateAgents = createAllSeedTeammateAgents;

export const createSpawnedTeammateAgent = (
  options: SpawnedTeammateOptions,
  deps: TeammateAgentDeps,
) => {
  const instructions = `You are a dynamically spawned teammate agent for AgencyOS specializing in ${options.specialization}.

You were created because: ${options.justification}

You execute assigned work under Project Manager delegation only. Never invent authority to contact clients or move money — client-facing and money actions require policy gates.

Operate through tools only:
- reportStatus: report progress, completion, or blockers on assigned work

Prefer short, actionable replies.`;

  return new Agent({
    id: options.id,
    name: options.specialization,
    instructions,
    model: process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini",
    tools: createTeammateTools({
      actionLogs: deps.actionLogs,
      agentName: options.id,
    }),
  });
};

export type SpawnedTeammateAgent = ReturnType<typeof createSpawnedTeammateAgent>;

export const resolveTeammateRole = (name: string): SeedTeammateRole | null =>
  isSeedTeammateRole(name) ? name : null;
