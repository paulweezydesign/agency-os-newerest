import { describe, expect, it } from "vitest";
import { createMastraApp, mastra } from "./index";

describe("createMastraApp", () => {
  it("exports a Mastra stub with empty agent, tool, and workflow registries", () => {
    const app = createMastraApp();

    expect(app).toBeDefined();
    expect(app.listAgents()).toEqual({});
    expect(app.listTools()).toEqual({});
    expect(app.listWorkflows()).toEqual({});

    expect(mastra).toBeDefined();
    expect(mastra.listAgents()).toEqual({});
    expect(mastra.listTools()).toEqual({});
    expect(mastra.listWorkflows()).toEqual({});
  });
});
