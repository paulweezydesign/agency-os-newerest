"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleCreateProject } from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";

export type CreateProjectActionState = {
  error?: string;
};

export const createProjectAction = async (
  clientId: string,
  _prev: CreateProjectActionState,
  formData: FormData,
): Promise<CreateProjectActionState> => {
  const session = toAuthSession(await auth());
  const service = await getProjectService();
  const result = await handleCreateProject({
    session,
    service,
    clientId,
    body: {
      name: String(formData.get("name") ?? ""),
      budget: String(formData.get("budget") ?? ""),
      timelineStart: String(formData.get("timelineStart") ?? ""),
      timelineEnd: String(formData.get("timelineEnd") ?? ""),
    },
  });

  if (result.status === 201) {
    revalidatePath(`/dashboard/clients/${clientId}`);
    redirect(`/dashboard/projects/${result.body.id}`);
  }

  const message =
    "error" in result.body ? result.body.error : "Unable to create project";
  return { error: message };
};
