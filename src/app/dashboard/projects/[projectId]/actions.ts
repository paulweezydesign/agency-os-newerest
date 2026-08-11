"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import {
  handleBindGithubRepo,
  handleRecordProjectSpend,
} from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";
import {
  handleCreateTask,
  handleUpdateTask,
} from "@/lib/tasks/tasks-api";
import { getTaskService } from "@/lib/tasks/get-task-service";

export type TaskActionState = {
  error?: string;
};

export type SpendActionState = {
  error?: string;
};

export type GithubBindActionState = {
  error?: string;
};

export const createTaskAction = async (
  projectId: string,
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> => {
  const session = toAuthSession(await auth());
  const service = await getTaskService();
  const headers = new Headers({
    "x-correlation-id": randomUUID(),
  });
  const assigneeRaw = String(formData.get("assignee") ?? "").trim();
  const result = await handleCreateTask({
    session,
    service,
    projectId,
    body: {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      assignee: assigneeRaw.length > 0 ? assigneeRaw : null,
    },
    headers,
  });

  if (result.status === 201) {
    revalidatePath(`/dashboard/projects/${projectId}`);
    return {};
  }

  return {
    error: "error" in result.body ? result.body.error : "Unable to create task",
  };
};

export const updateTaskStatusAction = async (
  projectId: string,
  taskId: string,
  status: "todo" | "in_progress" | "done",
): Promise<void> => {
  const session = toAuthSession(await auth());
  const service = await getTaskService();
  const headers = new Headers({
    "x-correlation-id": randomUUID(),
  });

  await handleUpdateTask({
    session,
    service,
    taskId,
    body: { status },
    headers,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
};

export const recordProjectSpendAction = async (
  projectId: string,
  _prev: SpendActionState,
  formData: FormData,
): Promise<SpendActionState> => {
  const session = toAuthSession(await auth());
  const service = await getProjectService();
  const result = await handleRecordProjectSpend({
    session,
    service,
    projectId,
    body: {
      amount: formData.get("amount"),
    },
  });

  if (result.status === 200) {
    revalidatePath(`/dashboard/projects/${projectId}`);
    return {};
  }

  return {
    error:
      "error" in result.body ? result.body.error : "Unable to record spend",
  };
};

export const bindGithubRepoAction = async (
  projectId: string,
  _prev: GithubBindActionState,
  formData: FormData,
): Promise<GithubBindActionState> => {
  const session = toAuthSession(await auth());
  const service = await getProjectService();
  const result = await handleBindGithubRepo({
    session,
    service,
    projectId,
    body: {
      githubRepo: String(formData.get("githubRepo") ?? ""),
    },
  });

  if (result.status === 200) {
    revalidatePath(`/dashboard/projects/${projectId}`);
    return {};
  }

  return {
    error:
      "error" in result.body
        ? result.body.error
        : "Unable to bind GitHub repo",
  };
};
