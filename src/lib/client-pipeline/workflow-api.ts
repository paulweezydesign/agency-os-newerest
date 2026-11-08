import { z, ZodError } from "zod";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import type { AuthSession } from "@/lib/auth/session-context";

export const isWorkflowEnabled = (env: Record<string, string | undefined> = process.env) =>
  (env.AGENCYOS_DRY_RUN_WORKFLOW === "true" || env.AGENCYOS_BETA_WORKFLOW === "dry-run") &&
  (env.VERCEL_ENV === "preview" || (!env.VERCEL_ENV && env.NODE_ENV !== "production"));

type WorkflowRequest = { tenantId: string; operatorId: string; clientId: string; runId: string; correlationId: string; leadScore: number };
type AccessInput = { session: AuthSession; enabled: boolean; clientId: string };
type ApiResult = { status: number; body: unknown };
const bodySchema = z.object({ runId: z.string().uuid(), leadScore: z.number().int().min(0).max(100) });

const accessFor = ({ session, enabled }: AccessInput) => {
  const access = resolveOperatorApiAccess(session);
  if (access.status === "unauthenticated") return { error: { status: 401, body: { error: "Unauthorized" } } };
  if (access.status === "forbidden") return { error: { status: 403, body: { error: "Forbidden" } } };
  if (!enabled) return { error: { status: 404, body: { error: "Workflow unavailable" } } };
  return { context: access.context };
};

export const handleRunWorkflow = async (input: AccessInput & {
  body: unknown;
  execute: (input: WorkflowRequest) => Promise<unknown>;
}): Promise<ApiResult> => {
  const access = accessFor(input);
  if (access.error) return access.error;
  try {
    const parsed = bodySchema.parse(input.body);
    const result = await input.execute({ ...parsed, tenantId: access.context.tenantId,
      operatorId: access.context.userId, clientId: input.clientId,
      correlationId: `client-pipeline:${parsed.runId}` });
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ZodError) return { status: 400, body: { error: "Invalid workflow request" } };
    if (error instanceof Error && "status" in error && [400, 404, 409].includes(Number(error.status))) {
      return { status: Number(error.status), body: { error: error.message } };
    }
    throw error;
  }
};

export const handleReadWorkflow = async (input: AccessInput & {
  runId: string;
  read: (tenantId: string, runId: string) => Promise<{ clientId: string } | null>;
}): Promise<ApiResult> => {
  const access = accessFor(input);
  if (access.error) return access.error;
  if (!z.string().uuid().safeParse(input.runId).success) return { status: 400, body: { error: "Invalid run ID" } };
  const run = await input.read(access.context.tenantId, input.runId);
  if (!run || run.clientId !== input.clientId) return { status: 404, body: { error: "Workflow run not found" } };
  return { status: 200, body: run };
};

export const handleWorkflowOperation = async (input: AccessInput & {
  body: unknown;
  execute: (input: WorkflowRequest) => Promise<unknown>;
  read: (tenantId: string, runId: string) => Promise<{ clientId: string } | null>;
  resume: (tenantId: string, clientId: string, runId: string) => Promise<unknown>;
}): Promise<ApiResult> => {
  const access = accessFor(input);
  if (access.error) return access.error;
  const parsed = z.object({ operation: z.enum(["start", "inspect", "resume"]).default("start"), runId: z.string().uuid() }).safeParse(input.body);
  if (!parsed.success) return { status: 400, body: { error: "Invalid workflow operation" } };
  if (parsed.data.operation === "start") return handleRunWorkflow(input);
  if (parsed.data.operation === "inspect") return handleReadWorkflow({ ...input, runId: parsed.data.runId });
  try {
    const result = await input.resume(access.context.tenantId, input.clientId, parsed.data.runId);
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof Error && "status" in error && [400, 404, 409].includes(Number(error.status))) {
      return { status: Number(error.status), body: { error: error.message } };
    }
    throw error;
  }
};
