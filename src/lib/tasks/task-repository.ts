import { randomUUID } from "node:crypto";
import type { Task, TaskStatus } from "./schemas";

export type TaskCreateRecord = {
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
};

export type TaskUpdateRecord = {
  title?: string;
  description?: string;
  status?: TaskStatus;
};

export type TaskRepository = {
  create: (input: TaskCreateRecord) => Promise<Task>;
  listByTenantAndProject: (
    tenantId: string,
    projectId: string,
  ) => Promise<Task[]>;
  getByTenantAndId: (tenantId: string, id: string) => Promise<Task | null>;
  updateByTenantAndId: (
    tenantId: string,
    id: string,
    patch: TaskUpdateRecord,
  ) => Promise<Task | null>;
};

export const createInMemoryTaskRepository = (): TaskRepository => {
  const tasks: Task[] = [];

  return {
    create: async (input) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: randomUUID(),
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      tasks.push(task);
      return task;
    },
    listByTenantAndProject: async (tenantId, projectId) =>
      tasks.filter(
        (task) => task.tenantId === tenantId && task.projectId === projectId,
      ),
    getByTenantAndId: async (tenantId, id) =>
      tasks.find((task) => task.tenantId === tenantId && task.id === id) ??
      null,
    updateByTenantAndId: async (tenantId, id, patch) => {
      const index = tasks.findIndex(
        (task) => task.tenantId === tenantId && task.id === id,
      );
      if (index < 0) {
        return null;
      }

      const current = tasks[index]!;
      const updated: Task = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      tasks[index] = updated;
      return updated;
    },
  };
};
