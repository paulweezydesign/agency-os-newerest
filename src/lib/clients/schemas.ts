import { z } from "zod";

export const createClientInputSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
});

export const clientSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
});

export type CreateClientInput = z.infer<typeof createClientInputSchema>;
export type Client = z.infer<typeof clientSchema>;
