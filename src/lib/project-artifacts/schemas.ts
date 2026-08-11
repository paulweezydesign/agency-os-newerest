import { z } from "zod";

export const artifactKindSchema = z.enum(["brief", "sow", "mvp_scaffold"]);

export const projectArtifactSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  kind: artifactKindSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.string().min(1),
});

export const createArtifactInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: z.string().trim().min(1, "Body is required"),
});

export const sendSowInputSchema = z.object({
  artifactId: z.string().min(1, "artifactId is required"),
});

export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ProjectArtifact = z.infer<typeof projectArtifactSchema>;
export type CreateArtifactInput = z.infer<typeof createArtifactInputSchema>;
export type SendSowInput = z.infer<typeof sendSowInputSchema>;
