export const SEED_TEAMMATE_ROLES = [
  "tech-lead",
  "design",
  "research",
  "frontend",
  "backend",
  "qa",
  "prospector",
  "nurture",
  "onboarding",
] as const;

export type SeedTeammateRole = (typeof SEED_TEAMMATE_ROLES)[number];

export const PROJECT_MANAGER_ROLE = "project-manager" as const;

export type SeedRosterRole = typeof PROJECT_MANAGER_ROLE | SeedTeammateRole;

export const SEED_ROSTER: readonly SeedRosterRole[] = [
  PROJECT_MANAGER_ROLE,
  ...SEED_TEAMMATE_ROLES,
];

export const SPAWN_CAP_PER_PROJECT = 10;

export const isSeedTeammateRole = (name: string): name is SeedTeammateRole =>
  (SEED_TEAMMATE_ROLES as readonly string[]).includes(name);

export const isChatableAgentName = (name: string): boolean =>
  name === PROJECT_MANAGER_ROLE ||
  isSeedTeammateRole(name) ||
  name.startsWith("spawned:");

export const teammateSafetyRules = (role: SeedTeammateRole): string => {
  switch (role) {
    case "tech-lead":
      return "Lead technical decisions under Project Manager delegation; never merge GitHub PRs; escalate client/money actions to a policy gate.";
    case "design":
      return "Produce design guidance only through tools under Project Manager delegation; no client-facing sends without a policy gate.";
    case "research":
      return "Research via tools under Project Manager delegation; cite sources; client outreach requires a policy gate.";
    case "frontend":
      return "Implement frontend Tasks under Project Manager delegation; open PRs when tools allow; never merge; client/money actions require a policy gate.";
    case "backend":
      return "Implement backend Tasks under Project Manager delegation; open PRs when tools allow; never merge; client/money actions require a policy gate.";
    case "qa":
      return "Test and report defects under Project Manager delegation; client communications require a policy gate.";
    case "prospector":
      return "Prospect leads under Project Manager delegation; client email requires a policy gate.";
    case "nurture":
      return "Nurture leads under Project Manager delegation; client email requires a policy gate.";
    case "onboarding":
      return "Onboard clients under Project Manager delegation; client-facing and money actions require a policy gate.";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
};
