import type { TaskService } from "@/lib/tasks/task-service";
import type { syncTaskToLinear } from "./push-task-to-linear";

type SyncFn = ReturnType<typeof syncTaskToLinear>;

export const withLinearTaskSync = (
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
