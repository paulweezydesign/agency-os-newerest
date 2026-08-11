"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleCreateClient } from "@/lib/clients/clients-api";
import { getClientService } from "@/lib/clients/get-client-service";

export type CreateClientActionState = {
  error?: string;
};

export const createClientAction = async (
  _prev: CreateClientActionState,
  formData: FormData,
): Promise<CreateClientActionState> => {
  const session = toAuthSession(await auth());
  const service = await getClientService();
  const result = await handleCreateClient({
    session,
    service,
    body: { name: String(formData.get("name") ?? "") },
  });

  if (result.status === 201) {
    revalidatePath("/dashboard/clients");
    redirect(`/dashboard/clients/${result.body.id}`);
  }

  const message =
    "error" in result.body ? result.body.error : "Unable to create client";
  return { error: message };
};
