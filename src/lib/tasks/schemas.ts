import { z } from "zod";

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1, "Task title is required"),
  description: z.string().trim().optional(),
});

export const updateTaskInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  status: taskStatusSchema.optional(),
});

export const taskSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: taskStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type Task = z.infer<typeof taskSchema>;
