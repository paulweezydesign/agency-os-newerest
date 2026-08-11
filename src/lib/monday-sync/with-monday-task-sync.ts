import type { TaskService } from "@/lib/tasks/task-service";
import type { syncTaskToMonday } from "./push-task-to-monday";

type SyncFn = ReturnType<typeof syncTaskToMonday>;

export const withMondayTaskSync = (
  service: TaskService,
  sync: SyncFn,
): TaskService => ({
  listByProject: service.listByProject,
  get: service.get,
  create: async (input) => {
    const created = await service.create(input);
    const { task } = await sync(created);
    return task;
  },
  update: async (input) => {
    const updated = await service.update(input);
    const { task } = await sync(updated);
    return task;
  },
});
