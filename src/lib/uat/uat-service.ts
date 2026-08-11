import { randomUUID } from "node:crypto";
import {
  ProjectNotFoundError,
  type ProjectService,
} from "@/lib/projects/project-service";
import {
  completeUatItemInputSchema,
  createUatChecklistInputSchema,
  type UatChecklist,
} from "./schemas";

export class UatChecklistNotFoundError extends Error {
  constructor(message = "UAT checklist not found") {
    super(message);
    this.name = "UatChecklistNotFoundError";
  }
}

export class UatStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UatStateError";
  }
}

export type UatService = {
  createChecklist: (input: {
    tenantId: string;
    projectId: string;
    labels: string[];
  }) => Promise<UatChecklist>;
  getByProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<UatChecklist | null>;
  completeItem: (input: {
    tenantId: string;
    projectId: string;
    itemId: string;
    actorId: string;
  }) => Promise<UatChecklist>;
  signOff: (input: {
    tenantId: string;
    projectId: string;
    actorId: string;
  }) => Promise<UatChecklist>;
};

export const createInMemoryUatService = (deps: {
  projects: Pick<ProjectService, "get">;
}): UatService => {
  const byProject = new Map<string, UatChecklist>();
  const key = (tenantId: string, projectId: string) =>
    `${tenantId}:${projectId}`;

  return {
    createChecklist: async ({ tenantId, projectId, labels }) => {
      const parsed = createUatChecklistInputSchema.parse({ labels });
      const project = await deps.projects.get(tenantId, projectId);
      if (!project) {
        throw new ProjectNotFoundError();
      }

      const checklist: UatChecklist = {
        id: randomUUID(),
        tenantId,
        projectId,
        items: parsed.labels.map((label) => ({
          id: randomUUID(),
          label,
          completed: false,
        })),
        createdAt: new Date().toISOString(),
      };
      byProject.set(key(tenantId, projectId), checklist);
      return checklist;
    },
    getByProject: async (tenantId, projectId) =>
      byProject.get(key(tenantId, projectId)) ?? null,
    completeItem: async ({ tenantId, projectId, itemId, actorId }) => {
      completeUatItemInputSchema.parse({ itemId });
      const checklist = byProject.get(key(tenantId, projectId));
      if (!checklist) {
        throw new UatChecklistNotFoundError();
      }
      if (checklist.signedOffAt) {
        throw new UatStateError("Checklist already signed off");
      }

      const item = checklist.items.find((entry) => entry.id === itemId);
      if (!item) {
        throw new UatChecklistNotFoundError("UAT item not found");
      }

      item.completed = true;
      item.completedBy = actorId;
      item.completedAt = new Date().toISOString();
      return checklist;
    },
    signOff: async ({ tenantId, projectId, actorId }) => {
      const checklist = byProject.get(key(tenantId, projectId));
      if (!checklist) {
        throw new UatChecklistNotFoundError();
      }
      if (checklist.signedOffAt) {
        throw new UatStateError("Already signed off");
      }
      if (!checklist.items.every((item) => item.completed)) {
        throw new UatStateError("All UAT items must be completed first");
      }

      checklist.signedOffAt = new Date().toISOString();
      checklist.signedOffBy = actorId;
      return checklist;
    },
  };
};
