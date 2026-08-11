import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "./budget-alert-repository";
import { createInMemoryProjectRepository } from "./project-repository";
import { createProjectService } from "./project-service";
import {
  handleListBudgetAlerts,
  handleRecordProjectSpend,
} from "./projects-api";

const operatorSession: AuthSession = {
  user: {
    id: "user-operator",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

const clientRoleSession: AuthSession = {
  user: {
    id: "user-client",
    role: "client",
    tenantId: "tenant-default",
  },
};

const createDeps = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const client = await clients.create({
    tenantId: "tenant-default",
    name: "Acme Co",
  });
  const project = await projects.create({
    tenantId: "tenant-default",
    clientId: client.id,
    name: "Website redesign",
    budget: 1000,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-12-01",
  });

  return { projects, project };
};

describe("project spend API handlers", () => {
  it("allows an operator to record spend and list budget alerts", async () => {
    const { projects, project } = await createDeps();

    const recorded = await handleRecordProjectSpend({
      session: operatorSession,
      service: projects,
      projectId: project.id,
      body: { amount: 1200 },
    });

    expect(recorded.status).toBe(200);
    if (recorded.status !== 200) {
      throw new Error("expected record success");
    }
    expect(recorded.body.project.spend).toBe(1200);
    expect(recorded.body.alerts.map((alert) => alert.threshold)).toEqual([
      80, 100, 120,
    ]);

    const listed = await handleListBudgetAlerts({
      session: operatorSession,
      service: projects,
      projectId: project.id,
    });

    expect(listed.status).toBe(200);
    if (listed.status !== 200) {
      throw new Error("expected list success");
    }
    expect(listed.body.map((alert) => alert.threshold)).toEqual([
      80, 100, 120,
    ]);
  });

  it("rejects unauthenticated spend and alert list", async () => {
    const { projects, project } = await createDeps();

    const recorded = await handleRecordProjectSpend({
      session: null,
      service: projects,
      projectId: project.id,
      body: { amount: 100 },
    });
    const listed = await handleListBudgetAlerts({
      session: null,
      service: projects,
      projectId: project.id,
    });

    expect(recorded).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
    expect(listed).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("rejects client-role spend and alert list", async () => {
    const { projects, project } = await createDeps();

    const recorded = await handleRecordProjectSpend({
      session: clientRoleSession,
      service: projects,
      projectId: project.id,
      body: { amount: 100 },
    });
    const listed = await handleListBudgetAlerts({
      session: clientRoleSession,
      service: projects,
      projectId: project.id,
    });

    expect(recorded).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
    expect(listed).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("returns 404 when recording spend for a missing project", async () => {
    const { projects } = await createDeps();

    const result = await handleRecordProjectSpend({
      session: operatorSession,
      service: projects,
      projectId: "missing",
      body: { amount: 100 },
    });

    expect(result).toEqual({
      status: 404,
      body: { error: "Project not found" },
    });
  });

  it("returns 400 for invalid spend amounts", async () => {
    const { projects, project } = await createDeps();

    const result = await handleRecordProjectSpend({
      session: operatorSession,
      service: projects,
      projectId: project.id,
      body: { amount: 0 },
    });

    expect(result).toEqual({
      status: 400,
      body: { error: "Invalid request" },
    });
  });
});
