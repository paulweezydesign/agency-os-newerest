import { describe, expect, it } from "vitest";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "./budget-alert-repository";
import { createInMemoryProjectRepository } from "./project-repository";
import { createProjectService } from "./project-service";

const createServices = () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  return { clients, projects };
};

const createProject = async (
  projects: ReturnType<typeof createServices>["projects"],
  clients: ReturnType<typeof createServices>["clients"],
  budget = 1000,
) => {
  const client = await clients.create({
    tenantId: "tenant-a",
    name: "Acme Co",
  });
  const project = await projects.create({
    tenantId: "tenant-a",
    clientId: client.id,
    name: "Website redesign",
    budget,
    timelineStart: "2026-09-01",
    timelineEnd: "2026-12-01",
  });
  return project;
};

describe("recordProjectSpend", () => {
  it("starts projects at zero spend", async () => {
    const { clients, projects } = createServices();
    const project = await createProject(projects, clients);

    expect(project.spend).toBe(0);
  });

  it("increments spend when recording a positive amount", async () => {
    const { clients, projects } = createServices();
    const project = await createProject(projects, clients);

    const result = await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 250,
    });

    expect(result.project.spend).toBe(250);
    expect(result.alerts).toEqual([]);
  });

  it("creates an 80% alert when crossing that threshold", async () => {
    const { clients, projects } = createServices();
    const project = await createProject(projects, clients);

    const result = await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 800,
    });

    expect(result.project.spend).toBe(800);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]).toMatchObject({
      tenantId: "tenant-a",
      projectId: project.id,
      threshold: 80,
    });
  });

  it("creates 80 and 100 alerts when jumping past both", async () => {
    const { clients, projects } = createServices();
    const project = await createProject(projects, clients);

    const result = await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 1000,
    });

    expect(result.alerts.map((alert) => alert.threshold)).toEqual([80, 100]);
  });

  it("creates 80, 100, and 120 alerts when jumping past all bands", async () => {
    const { clients, projects } = createServices();
    const project = await createProject(projects, clients);

    const result = await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 1200,
    });

    expect(result.alerts.map((alert) => alert.threshold)).toEqual([
      80, 100, 120,
    ]);
  });

  it("does not duplicate alerts for the same threshold", async () => {
    const { clients, projects } = createServices();
    const project = await createProject(projects, clients);

    await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 800,
    });
    const second = await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 50,
    });

    expect(second.project.spend).toBe(850);
    expect(second.alerts).toEqual([]);

    const listed = await projects.listBudgetAlerts("tenant-a", project.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.threshold).toBe(80);
  });

  it("creates only newly crossed thresholds on subsequent spend", async () => {
    const { clients, projects } = createServices();
    const project = await createProject(projects, clients);

    await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 800,
    });
    const result = await projects.recordSpend({
      tenantId: "tenant-a",
      projectId: project.id,
      amount: 400,
    });

    expect(result.project.spend).toBe(1200);
    expect(result.alerts.map((alert) => alert.threshold)).toEqual([
      100, 120,
    ]);

    const listed = await projects.listBudgetAlerts("tenant-a", project.id);
    expect(listed.map((alert) => alert.threshold)).toEqual([80, 100, 120]);
  });

  it("rejects record spend when the project is missing", async () => {
    const { projects } = createServices();

    await expect(
      projects.recordSpend({
        tenantId: "tenant-a",
        projectId: "missing",
        amount: 100,
      }),
    ).rejects.toThrow(/project/i);
  });
});
