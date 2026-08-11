import { describe, expect, it } from "vitest";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryProjectRepository } from "./project-repository";
import { createProjectService } from "./project-service";

const createServices = () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
  );
  return { clients, projects };
};

describe("createProjectService", () => {
  it("creates a project under a client for the given tenant", async () => {
    const { clients, projects } = createServices();
    const client = await clients.create({
      tenantId: "tenant-a",
      name: "Acme Co",
    });

    const created = await projects.create({
      tenantId: "tenant-a",
      clientId: client.id,
      name: "Website redesign",
      budget: 25000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
    });

    expect(created).toMatchObject({
      tenantId: "tenant-a",
      clientId: client.id,
      name: "Website redesign",
      budget: 25000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
    });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();
  });

  it("lists only projects for the requested client and tenant", async () => {
    const { clients, projects } = createServices();
    const clientA = await clients.create({
      tenantId: "tenant-a",
      name: "Acme Co",
    });
    const clientB = await clients.create({
      tenantId: "tenant-a",
      name: "Beta Co",
    });

    await projects.create({
      tenantId: "tenant-a",
      clientId: clientA.id,
      name: "Project A",
      budget: 1000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-10-01",
    });
    await projects.create({
      tenantId: "tenant-a",
      clientId: clientB.id,
      name: "Project B",
      budget: 2000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-10-01",
    });

    const listed = await projects.listByClient("tenant-a", clientA.id);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Project A");
  });

  it("gets a project by id within the same tenant", async () => {
    const { clients, projects } = createServices();
    const client = await clients.create({
      tenantId: "tenant-a",
      name: "Acme Co",
    });
    const created = await projects.create({
      tenantId: "tenant-a",
      clientId: client.id,
      name: "Website redesign",
      budget: 25000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
    });

    const found = await projects.get("tenant-a", created.id);

    expect(found).toEqual(created);
  });

  it("returns null when getting a project from another tenant", async () => {
    const { clients, projects } = createServices();
    const client = await clients.create({
      tenantId: "tenant-a",
      name: "Acme Co",
    });
    const created = await projects.create({
      tenantId: "tenant-a",
      clientId: client.id,
      name: "Website redesign",
      budget: 25000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
    });

    const found = await projects.get("tenant-b", created.id);

    expect(found).toBeNull();
  });

  it("rejects create when the client is missing for the tenant", async () => {
    const { projects } = createServices();

    await expect(
      projects.create({
        tenantId: "tenant-a",
        clientId: "missing-client",
        name: "Orphan project",
        budget: 1000,
        timelineStart: "2026-09-01",
        timelineEnd: "2026-10-01",
      }),
    ).rejects.toThrow(/client/i);
  });
});
