import { describe, expect, it } from "vitest";
import { createInMemoryExaClient, ExaClientError } from "./exa-client";

describe("createInMemoryExaClient", () => {
  it("returns seeded results and records queries", async () => {
    const exa = createInMemoryExaClient([
      {
        title: "Lead scoring guide",
        url: "https://example.com/leads",
        snippet: "Score leads before nurture.",
      },
    ]);

    const results = await exa.search({ query: "lead", numResults: 3 });

    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://example.com/leads");
    expect(exa.queries).toEqual(["lead"]);
  });

  it("rejects empty queries", async () => {
    const exa = createInMemoryExaClient();
    await expect(exa.search({ query: "   " })).rejects.toBeInstanceOf(
      ExaClientError,
    );
  });
});
