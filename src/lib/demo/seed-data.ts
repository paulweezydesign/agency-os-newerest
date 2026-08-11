import { randomUUID } from "node:crypto";
import {
  DEFAULT_TENANT_ID,
  SEED_CLIENT_ID,
} from "@/lib/auth/seed-users";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import type { Client } from "@/lib/clients/schemas";
import { createInMemoryArtifactRepository } from "@/lib/project-artifacts/artifact-repository";
import { createArtifactService } from "@/lib/project-artifacts/artifact-service";
import type { ProjectArtifact } from "@/lib/project-artifacts/schemas";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import type { Project } from "@/lib/projects/schemas";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import type { Task } from "@/lib/tasks/schemas";

export type SeedResult = {
  tenantId: string;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  artifacts: ProjectArtifact[];
};

/** In-memory seed of Clients, Projects, Tasks, and agent artifacts for demos. */
export const seedDemoData = async (
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<SeedResult> => {
  const actionLogs = createInMemoryAgentActionLogRepository();
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const tasks = createTaskService(
    createInMemoryTaskRepository(),
    projects,
    actionLogs,
  );
  const artifacts = createArtifactService(
    createInMemoryArtifactRepository(),
    projects,
    actionLogs,
    {
      request: async ({ correlationId }) => ({
        id: `gate-${correlationId}`,
        tenantId,
        actionType: "sow_send" as const,
        status: "pending" as const,
        payload: {},
        requestedBy: "seed",
        correlationId,
        effectRan: false,
        createdAt: new Date().toISOString(),
      }),
    },
  );

  const portalClient = await clients.create({
    tenantId,
    id: SEED_CLIENT_ID,
    name: "Acme Co",
    contactEmail: "client@agencyos.local",
  });
  await clients.updatePipeline(tenantId, portalClient.id, {
    pipelineStage: "onboard",
    leadScore: 88,
    contactEmail: "client@agencyos.local",
  });

  const secondClient = await clients.create({
    tenantId,
    name: "Bright Studio",
    contactEmail: "hello@bright.example",
  });
  await clients.updatePipeline(tenantId, secondClient.id, {
    pipelineStage: "nurture",
    leadScore: 55,
    contactEmail: "hello@bright.example",
  });

  const project = await projects.create({
    tenantId,
    clientId: portalClient.id,
    name: "Acme Marketing Site",
    budget: 25_000,
    timelineStart: "2026-01-01",
    timelineEnd: "2026-04-01",
  });

  const taskTitles = [
    "Draft homepage brief",
    "Wire Figma homepage",
    "Open agent PR for hero",
  ] as const;

  const createdTasks = await Promise.all(
    taskTitles.map((title) =>
      tasks.create({
        tenantId,
        projectId: project.id,
        title,
        correlationId: randomUUID(),
        actorName: "seed-script",
      }),
    ),
  );

  const brief = await artifacts.createProjectBrief({
    tenantId,
    projectId: project.id,
    title: "Acme brief",
    body: "Refresh marketing site with portal-ready delivery.",
    correlationId: randomUUID(),
    actorName: "seed-script",
  });

  const listedClients = await clients.list(tenantId);

  return {
    tenantId,
    clients: listedClients,
    projects: [project],
    tasks: createdTasks,
    artifacts: [brief],
  };
};

export const formatSeedSummary = (seed: SeedResult): string =>
  [
    `tenant=${seed.tenantId}`,
    `clients=${seed.clients.length}`,
    `projects=${seed.projects.length}`,
    `tasks=${seed.tasks.length}`,
    `artifacts=${seed.artifacts.length}`,
  ].join(" ");
