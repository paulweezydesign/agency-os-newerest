import { describe, expect, it } from "vitest";
import {
  PROJECT_MANAGER_ROLE,
  SEED_ROSTER,
  SEED_TEAMMATE_ROLES,
  SPAWN_CAP_PER_PROJECT,
  isChatableAgentName,
  isSeedTeammateRole,
  teammateSafetyRules,
} from "./seed-roster";

describe("SEED_ROSTER", () => {
  it("registers the ten seed roles including Project Manager", () => {
    expect(SEED_ROSTER).toHaveLength(10);
    expect(SEED_ROSTER).toEqual([
      "project-manager",
      "tech-lead",
      "design",
      "research",
      "frontend",
      "backend",
      "qa",
      "prospector",
      "nurture",
      "onboarding",
    ]);
    expect(PROJECT_MANAGER_ROLE).toBe("project-manager");
    expect(SEED_TEAMMATE_ROLES).toHaveLength(9);
  });

  it("exposes safety rules for each teammate with policy-gate language", () => {
    for (const role of SEED_TEAMMATE_ROLES) {
      const rules = teammateSafetyRules(role);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.toLowerCase()).toMatch(/policy gate/);
    }
  });

  it("identifies chatable seed roster and spawned agent names", () => {
    expect(isSeedTeammateRole("frontend")).toBe(true);
    expect(isSeedTeammateRole("project-manager")).toBe(false);
    expect(isChatableAgentName("project-manager")).toBe(true);
    expect(isChatableAgentName("qa")).toBe(true);
    expect(isChatableAgentName("spawned:abc")).toBe(true);
    expect(isChatableAgentName("unknown")).toBe(false);
  });

  it("documents the dynamic spawn cap of 10 per project", () => {
    expect(SPAWN_CAP_PER_PROJECT).toBe(10);
  });
});
