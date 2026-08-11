import { describe, expect, it } from "vitest";
import { SEED_CLIENT_ID } from "@/lib/auth/seed-users";
import { formatSeedSummary, seedDemoData } from "./seed-data";

describe("seedDemoData", () => {
  it("creates sample clients, projects, tasks, and artifacts", async () => {
    const seed = await seedDemoData();

    expect(seed.clients.map((client) => client.id)).toContain(SEED_CLIENT_ID);
    expect(seed.projects).toHaveLength(1);
    expect(seed.tasks.length).toBeGreaterThanOrEqual(3);
    expect(seed.artifacts[0]?.kind).toBe("brief");
    expect(formatSeedSummary(seed)).toContain("clients=2");
  });
});
