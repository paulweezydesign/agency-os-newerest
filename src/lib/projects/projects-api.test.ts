import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "./budget-alert-repository";
import { createInMemoryProjectRepository } from "./project-repository";
import { createProjectService } from "./project-service";
import {
  handleCreateProject,
  handleGetProject,
  handleListProjectsForClient,
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

  return { clients, projects, client };
};

const projectBody = {
  name: "Website redesign",
  budget: 25000,
  timelineStart: "2026-09-01",
  timelineEnd: "2026-12-01",
};

describe("projects API handlers", () => {
  it("allows an operator to create and list projects under a client", async () => {
    const { projects, client } = await createDeps();

    const created = await handleCreateProject({
      session: operatorSession,
      service: projects,
      clientId: client.id,
      body: projectBody,
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      tenantId: "tenant-default",
      clientId: client.id,
      name: "Website redesign",
      budget: 25000,
    });

    const listed = await handleListProjectsForClient({
      session: operatorSession,
      service: projects,
      clientId: client.id,
    });

    expect(listed.status).toBe(200);
    if (listed.status !== 200) {
      throw new Error("expected list success");
    }
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ name: "Website redesign" });
  });

  it("allows an operator to get a project by id", async () => {
    const { projects, client } = await createDeps();
    const created = await handleCreateProject({
      session: operatorSession,
      service: projects,
      clientId: client.id,
      body: projectBody,
    });

    const projectId =
      created.status === 201 && "id" in created.body ? created.body.id : "";

    const result = await handleGetProject({
      session: operatorSession,
      service: projects,
      projectId,
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      id: projectId,
      clientId: client.id,
      name: "Website redesign",
    });
  });

  it("rejects unauthenticated create/list/get", async () => {
    const { projects, client } = await createDeps();

    const created = await handleCreateProject({
      session: null,
      service: projects,
      clientId: client.id,
      body: projectBody,
    });
    const listed = await handleListProjectsForClient({
      session: null,
      service: projects,
      clientId: client.id,
    });
    const got = await handleGetProject({
      session: null,
      service: projects,
      projectId: "missing",
    });

    expect(created).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
    expect(listed).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
    expect(got).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("rejects client-role access to create/list/get", async () => {
    const { projects, client } = await createDeps();

    const created = await handleCreateProject({
      session: clientRoleSession,
      service: projects,
      clientId: client.id,
      body: projectBody,
    });
    const listed = await handleListProjectsForClient({
      session: clientRoleSession,
      service: projects,
      clientId: client.id,
    });
    const got = await handleGetProject({
      session: clientRoleSession,
      service: projects,
      projectId: "missing",
    });

    expect(created).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
    expect(listed).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
    expect(got).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("returns 404 when creating under a missing client", async () => {
    const { projects } = await createDeps();

    const result = await handleCreateProject({
      session: operatorSession,
      service: projects,
      clientId: "missing-client",
      body: projectBody,
    });

    expect(result).toEqual({
      status: 404,
      body: { error: "Client not found" },
    });
  });

  it("returns 404 when an operator requests a missing project", async () => {
    const { projects } = await createDeps();

    const result = await handleGetProject({
      session: operatorSession,
      service: projects,
      projectId: "does-not-exist",
    });

    expect(result).toEqual({
      status: 404,
      body: { error: "Not found" },
    });
  });
});
