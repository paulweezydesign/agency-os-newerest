import type { Task, TaskStatus } from "@/lib/tasks/schemas";

export type MondayItemStatus = "not_started" | "working_on_it" | "done";

export type MondayItemPayload = {
  id: string;
  title: string;
  description: string;
  status: MondayItemStatus;
  assignee: string | null;
};

export type AgencyOwnedScope = {
  title: string;
  description: string;
};

export type MondayOutboundItem = {
  title: string;
  description: string;
  status: MondayItemStatus;
  assignee: string | null;
};

export type MondayInboundPatchResult = {
  patch: {
    status: TaskStatus;
    assignee: string | null;
  };
  rejectedFields: Array<"title" | "description">;
};

const agencyStatusToMonday = (status: TaskStatus): MondayItemStatus => {
  switch (status) {
    case "todo":
      return "not_started";
    case "in_progress":
      return "working_on_it";
    case "done":
      return "done";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

const mondayStatusToAgency = (status: MondayItemStatus): TaskStatus => {
  switch (status) {
    case "not_started":
      return "todo";
    case "working_on_it":
      return "in_progress";
    case "done":
      return "done";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

export const mapAgencyTaskToMonday = (task: Task): MondayOutboundItem => ({
  title: task.title,
  description: task.description,
  status: agencyStatusToMonday(task.status),
  assignee: task.assignee,
});

export const mapMondayToAgencyTaskPatch = (
  item: MondayItemPayload,
  owned?: AgencyOwnedScope,
): MondayInboundPatchResult => {
  const rejectedFields: Array<"title" | "description"> = [];

  if (owned) {
    if (item.title !== owned.title) {
      rejectedFields.push("title");
    }
    if (item.description !== owned.description) {
      rejectedFields.push("description");
    }
  }

  return {
    patch: {
      status: mondayStatusToAgency(item.status),
      assignee: item.assignee,
    },
    rejectedFields,
  };
};
