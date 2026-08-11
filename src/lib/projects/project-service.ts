import type { ClientService } from "@/lib/clients/client-service";
import type { BudgetAlertRepository } from "./budget-alert-repository";
import { evaluateBudgetGuardrails } from "./budget-guardrails";
import type { ProjectRepository } from "./project-repository";
import {
  bindGithubRepoInputSchema,
  createProjectInputSchema,
  recordProjectSpendInputSchema,
  type BindGithubRepoInput,
  type BudgetAlert,
  type CreateProjectInput,
  type Project,
  type RecordProjectSpendInput,
} from "./schemas";

export class ClientNotFoundError extends Error {
  constructor(message = "Client not found for tenant") {
    super(message);
    this.name = "ClientNotFoundError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor(message = "Project not found for tenant") {
    super(message);
    this.name = "ProjectNotFoundError";
  }
}

export type RecordSpendResult = {
  project: Project;
  alerts: BudgetAlert[];
};

export type ProjectService = {
  create: (
    input: CreateProjectInput & { tenantId: string; clientId: string },
  ) => Promise<Project>;
  listByClient: (tenantId: string, clientId: string) => Promise<Project[]>;
  get: (tenantId: string, id: string) => Promise<Project | null>;
  recordSpend: (
    input: RecordProjectSpendInput & { tenantId: string; projectId: string },
  ) => Promise<RecordSpendResult>;
  listBudgetAlerts: (
    tenantId: string,
    projectId: string,
  ) => Promise<BudgetAlert[]>;
  bindGithubRepo: (
    input: BindGithubRepoInput & { tenantId: string; projectId: string },
  ) => Promise<Project>;
  recordDeposit: (input: {
    tenantId: string;
    projectId: string;
    amount: number;
  }) => Promise<Project>;
};

export const createProjectService = (
  repository: ProjectRepository,
  clients: Pick<ClientService, "get">,
  budgetAlerts: BudgetAlertRepository,
): ProjectService => ({
  create: async ({ tenantId, clientId, ...input }) => {
    const parsed = createProjectInputSchema.parse(input);
    const client = await clients.get(tenantId, clientId);

    if (!client) {
      throw new ClientNotFoundError();
    }

    return repository.create({
      tenantId,
      clientId,
      name: parsed.name,
      budget: parsed.budget,
      timelineStart: parsed.timelineStart,
      timelineEnd: parsed.timelineEnd,
    });
  },
  listByClient: (tenantId, clientId) =>
    repository.listByTenantAndClient(tenantId, clientId),
  get: (tenantId, id) => repository.getByTenantAndId(tenantId, id),
  recordSpend: async ({ tenantId, projectId, ...input }) => {
    const parsed = recordProjectSpendInputSchema.parse(input);
    const project = await repository.getByTenantAndId(tenantId, projectId);

    if (!project) {
      throw new ProjectNotFoundError();
    }

    const nextSpend = project.spend + parsed.amount;
    const updated = await repository.updateSpendByTenantAndId(
      tenantId,
      projectId,
      nextSpend,
    );

    if (!updated) {
      throw new ProjectNotFoundError();
    }

    const crossed = evaluateBudgetGuardrails({
      budget: updated.budget,
      spend: updated.spend,
    });

    const createdAlerts = (
      await Promise.all(
        crossed.map((threshold) =>
          budgetAlerts.createIfAbsent({
            tenantId,
            projectId,
            threshold,
            spend: updated.spend,
            budget: updated.budget,
          }),
        ),
      )
    )
      .filter((alert): alert is BudgetAlert => alert !== null)
      .sort((a, b) => a.threshold - b.threshold);

    return {
      project: updated,
      alerts: createdAlerts,
    };
  },
  listBudgetAlerts: (tenantId, projectId) =>
    budgetAlerts.listByTenantAndProject(tenantId, projectId),
  bindGithubRepo: async ({ tenantId, projectId, ...input }) => {
    const parsed = bindGithubRepoInputSchema.parse(input);
    const project = await repository.getByTenantAndId(tenantId, projectId);

    if (!project) {
      throw new ProjectNotFoundError();
    }

    const updated = await repository.updateGithubRepoByTenantAndId(
      tenantId,
      projectId,
      parsed.githubRepo,
    );

    if (!updated) {
      throw new ProjectNotFoundError();
    }

    return updated;
  },
  recordDeposit: async ({ tenantId, projectId, amount }) => {
    if (!(amount > 0)) {
      throw new Error("Deposit amount must be positive");
    }

    const project = await repository.getByTenantAndId(tenantId, projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const updated = await repository.updateDepositTotalByTenantAndId(
      tenantId,
      projectId,
      project.depositTotal + amount,
    );

    if (!updated) {
      throw new ProjectNotFoundError();
    }

    return updated;
  },
});
