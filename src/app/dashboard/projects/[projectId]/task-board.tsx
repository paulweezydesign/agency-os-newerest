import { updateTaskStatusAction } from "./actions";
import type { Task } from "@/lib/tasks/schemas";

type TaskBoardProps = {
  projectId: string;
  tasks: Task[];
};

const columns = [
  { status: "todo" as const, label: "To do" },
  { status: "in_progress" as const, label: "In progress" },
  { status: "done" as const, label: "Done" },
];

export const TaskBoard = ({ projectId, tasks }: TaskBoardProps) => (
  <div className="grid gap-4 md:grid-cols-3">
    {columns.map((column) => {
      const columnTasks = tasks.filter((task) => task.status === column.status);

      return (
        <section
          key={column.status}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-600">
            {column.label}
          </h3>
          <ul className="mt-3 space-y-3">
            {columnTasks.length === 0 ? (
              <li className="text-xs text-slate-500">No tasks</li>
            ) : (
              columnTasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="font-medium text-slate-900">{task.title}</p>
                  {task.description ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {task.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Assignee: {task.assignee ?? "Unassigned"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {columns
                      .filter((item) => item.status !== task.status)
                      .map((item) => (
                        <form
                          key={item.status}
                          action={updateTaskStatusAction.bind(
                            null,
                            projectId,
                            task.id,
                            item.status,
                          )}
                        >
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            type="submit"
                          >
                            Move to {item.label}
                          </button>
                        </form>
                      ))}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      );
    })}
  </div>
);
