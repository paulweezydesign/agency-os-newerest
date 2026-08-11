import type { Task, TaskStatus } from "@/lib/tasks/schemas";

export type LinearIssueStatus = "unstarted" | "started" | "completed";

export type LinearIssuePayload = {
  id: string;
  title: string;
  description: string;
  status: LinearIssueStatus;
  assignee: string | null;
};

export type AgencyOwnedScope = {
  title: string;
  description: string;
};

export type LinearOutboundIssue = {
  title: string;
  description: string;
  status: LinearIssueStatus;
  assignee: string | null;
};

export type LinearInboundPatchResult = {
  patch: {
    status: TaskStatus;
    assignee: string | null;
  };
  rejectedFields: Array<"title" | "description">;
};

const agencyStatusToLinear = (status: TaskStatus): LinearIssueStatus => {
  switch (status) {
    case "todo":
      return "unstarted";
    case "in_progress":
      return "started";
    case "done":
      return "completed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

const linearStatusToAgency = (status: LinearIssueStatus): TaskStatus => {
  switch (status) {
    case "unstarted":
      return "todo";
    case "started":
      return "in_progress";
    case "completed":
      return "done";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

export const mapAgencyTaskToLinear = (task: Task): LinearOutboundIssue => ({
  title: task.title,
  description: task.description,
  status: agencyStatusToLinear(task.status),
  assignee: task.assignee,
});

export const mapLinearToAgencyTaskPatch = (
  issue: LinearIssuePayload,
  owned?: AgencyOwnedScope,
): LinearInboundPatchResult => {
  const rejectedFields: Array<"title" | "description"> = [];

  if (owned) {
    if (issue.title !== owned.title) {
      rejectedFields.push("title");
    }
    if (issue.description !== owned.description) {
      rejectedFields.push("description");
    }
  }

  return {
    patch: {
      status: linearStatusToAgency(issue.status),
      assignee: issue.assignee,
    },
    rejectedFields,
  };
};
