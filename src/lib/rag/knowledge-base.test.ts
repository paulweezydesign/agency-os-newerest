import { describe, expect, it } from "vitest";
import { createHashEmbeddingClient } from "./embeddings";
import { createInMemoryKnowledgeBase } from "./knowledge-base";

describe("createInMemoryKnowledgeBase", () => {
  it("ingests documents and returns attributed query answers", async () => {
    const kb = createInMemoryKnowledgeBase(createHashEmbeddingClient());

    await kb.ingest("tenant-a", {
      sourceId: "doc-1",
      title: "Nurture playbook",
      text: "Nurture mid-score leads with a gated follow-up email sequence.",
      url: "https://example.com/nurture",
    });
    await kb.ingest("tenant-a", {
      sourceId: "doc-2",
      title: "Onboarding checklist",
      text: "High-score leads skip nurture and enter onboarding immediately.",
      url: "https://example.com/onboard",
    });

    const result = await kb.query("tenant-a", {
      query: "nurture leads email",
      limit: 2,
    });

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0]?.sourceId).toBeTruthy();
    expect(result.sources[0]?.title).toBeTruthy();
    expect(result.answer).toMatch(/source/i);
  });

  it("scopes query results by tenant", async () => {
    const kb = createInMemoryKnowledgeBase(createHashEmbeddingClient());
    await kb.ingest("tenant-a", {
      sourceId: "a1",
      title: "A only",
      text: "secret alpha knowledge",
    });

    const result = await kb.query("tenant-b", {
      query: "secret alpha knowledge",
    });

    expect(result.sources).toHaveLength(0);
  });
});
