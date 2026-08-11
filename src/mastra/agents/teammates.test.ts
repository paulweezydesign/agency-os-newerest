import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { SEED_TEAMMATE_ROLES } from "@/lib/agents/seed-roster";
import {
  createAllSeedTeammateAgents,
  createSpawnedTeammateAgent,
  createTeammateAgent,
} from "./teammates";

describe("seed teammate agents", () => {
  it("registers each seed teammate with reportStatus and safety rules", async () => {
    const actionLogs = createInMemoryAgentActionLogRepository();
    const agents = createAllSeedTeammateAgents({ actionLogs });

    expect(Object.keys(agents).sort()).toEqual([...SEED_TEAMMATE_ROLES].sort());

    for (const role of SEED_TEAMMATE_ROLES) {
      const agent = agents[role];
      const tools = await agent.listTools();
      const instructions = await agent.getInstructions();

      expect(agent.id).toBe(role);
      expect(Object.keys(tools)).toEqual(["reportStatus"]);
      expect(instructions).toMatch(/Project Manager/i);
      expect(instructions).toMatch(/policy gate/i);
      expect(instructions).toMatch(/reportStatus/);
    }
  });

  it("registers Exa and RAG tools on the research teammate when deps provided", async () => {
    const actionLogs = createInMemoryAgentActionLogRepository();
    const { createInMemoryExaClient } = await import("@/lib/exa/exa-client");
    const { createHashEmbeddingClient } = await import(
      "@/lib/rag/embeddings"
    );
    const { createInMemoryKnowledgeBase } = await import(
      "@/lib/rag/knowledge-base"
    );

    const agent = createTeammateAgent("research", {
      actionLogs,
      research: {
        exa: createInMemoryExaClient(),
        knowledgeBase: createInMemoryKnowledgeBase(
          createHashEmbeddingClient(),
        ),
      },
    });
    const tools = await agent.listTools();

    expect(Object.keys(tools).sort()).toEqual(
      ["exaSearch", "ingestDocument", "queryKnowledge", "reportStatus"].sort(),
    );
  });

  it("creates a single seed teammate by role name", async () => {
    const actionLogs = createInMemoryAgentActionLogRepository();
    const agent = createTeammateAgent("frontend", { actionLogs });
    expect(agent.id).toBe("frontend");
    expect(agent.name).toBe("Frontend");
  });

  it("creates spawned teammates with specialization and justification in instructions", async () => {
    const actionLogs = createInMemoryAgentActionLogRepository();
    const agent = createSpawnedTeammateAgent(
      {
        id: "spawned:spawn-1",
        specialization: "motion-design",
        justification: "Need trailer motion",
      },
      { actionLogs },
    );
    const instructions = await agent.getInstructions();
    const tools = await agent.listTools();

    expect(agent.id).toBe("spawned:spawn-1");
    expect(instructions).toMatch(/motion-design/);
    expect(instructions).toMatch(/Need trailer motion/);
    expect(instructions).toMatch(/policy gate/i);
    expect(Object.keys(tools)).toEqual(["reportStatus"]);
  });
});
