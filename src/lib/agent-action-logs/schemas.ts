import { z } from "zod";

export const agentActionLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  agentName: z.string().min(1),
  toolName: z.string().min(1),
  input: z.unknown(),
  output: z.unknown(),
  status: z.enum(["success", "error"]),
  correlationId: z.string().min(1),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  timestamp: z.string().min(1),
});

export type AgentActionLog = z.infer<typeof agentActionLogSchema>;

export type AgentActionLogCreateInput = {
  tenantId: string;
  agentName: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: "success" | "error";
  correlationId: string;
  projectId?: string;
  taskId?: string;
};
