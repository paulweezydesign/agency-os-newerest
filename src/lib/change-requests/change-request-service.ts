import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import type { ChangeRequestRepository } from "./change-request-repository";
import {
  createChangeRequestInputSchema,
  decideChangeRequestInputSchema,
  type ChangeRequest,
} from "./schemas";

export class ChangeRequestNotFoundError extends Error {
  constructor(message = "Change request not found") {
    super(message);
    this.name = "ChangeRequestNotFoundError";
  }
}

export class ChangeRequestStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChangeRequestStateError";
  }
}

export type ChangeRequestService = {
  create: (input: {
    tenantId: string;
    projectId: string;
    title: string;
    scopeImpact: string;
    timelineImpact: string;
    budgetImpact: number;
    createdBy: string;
    createdByRole: "agency" | "client";
  }) => Promise<ChangeRequest>;
  listByProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<ChangeRequest[]>;
  decide: (input: {
    tenantId: string;
    changeRequestId: string;
    decision: "approve" | "reject";
    actorId: string;
    actorRole: "agency" | "client";
  }) => Promise<ChangeRequest>;
};

export const createChangeRequestService = (deps: {
  changeRequests: ChangeRequestRepository;
  projects: Pick<ProjectService, "get">;
}): ChangeRequestService => ({
  create: async ({
    tenantId,
    projectId,
    createdBy,
    createdByRole,
    ...input
  }) => {
    const parsed = createChangeRequestInputSchema.parse(input);
    const project = await deps.projects.get(tenantId, projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return deps.changeRequests.create({
      tenantId,
      projectId,
      title: parsed.title,
      scopeImpact: parsed.scopeImpact,
      timelineImpact: parsed.timelineImpact,
      budgetImpact: parsed.budgetImpact,
      status: createdByRole === "agency" ? "pending_client" : "pending_agency",
      createdBy,
      createdByRole,
    });
  },
  listByProject: (tenantId, projectId) =>
    deps.changeRequests.listByProject(tenantId, projectId),
  decide: async ({
    tenantId,
    changeRequestId,
    decision,
    actorId,
    actorRole,
  }) => {
    decideChangeRequestInputSchema.parse({ decision });
    const existing = await deps.changeRequests.getByTenantAndId(
      tenantId,
      changeRequestId,
    );
    if (!existing) {
      throw new ChangeRequestNotFoundError();
    }

    if (existing.status === "approved" || existing.status === "rejected") {
      throw new ChangeRequestStateError(`Already ${existing.status}`);
    }

    if (decision === "reject") {
      const updated = await deps.changeRequests.update(
        tenantId,
        changeRequestId,
        {
          status: "rejected",
          decidedAt: new Date().toISOString(),
          ...(actorRole === "agency"
            ? { agencyApprovedBy: actorId }
            : { clientApprovedBy: actorId }),
        },
      );
      if (!updated) {
        throw new ChangeRequestNotFoundError();
      }
      return updated;
    }

    if (actorRole === "agency") {
      if (existing.status !== "pending_agency") {
        throw new ChangeRequestStateError(
          "Agency can only approve when pending_agency",
        );
      }
      const updated = await deps.changeRequests.update(
        tenantId,
        changeRequestId,
        {
          status: "approved",
          agencyApprovedBy: actorId,
          decidedAt: new Date().toISOString(),
        },
      );
      if (!updated) {
        throw new ChangeRequestNotFoundError();
      }
      return updated;
    }

    if (existing.status !== "pending_client") {
      throw new ChangeRequestStateError(
        "Client can only approve when pending_client",
      );
    }

    const updated = await deps.changeRequests.update(
      tenantId,
      changeRequestId,
      {
        status: "approved",
        clientApprovedBy: actorId,
        decidedAt: new Date().toISOString(),
      },
    );
    if (!updated) {
      throw new ChangeRequestNotFoundError();
    }
    return updated;
  },
});
