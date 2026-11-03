import { z, ZodError } from "zod";
import type { AuthSession } from "@/lib/auth/session-context";
import { resolveOperatorApiAccess } from "@/lib/auth/operator-api-access";
import { fingerprint } from "@/lib/policy-gates/request-identity";
import {
  createBetaWorkflowRuntime,
  WorkflowConflictError,
  type BetaWorkflowRuntime,
} from "./beta-workflow-runtime";

const bodySchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("start"),
      requestId: z.string().uuid(),
      leadScore: z.number().int().min(0).max(100),
    })
    .strict(),
  z
    .object({
      operation: z.enum(["inspect", "resume"]),
      requestId: z.string().uuid(),
    })
    .strict(),
]);
export const handleBetaWorkflow = async (input: {
  session: AuthSession;
  clientId: string;
  body: unknown;
  loadRuntime?: () => Promise<BetaWorkflowRuntime>;
}) => {
  const access = resolveOperatorApiAccess(input.session);
  if (access.status !== "allow")
    return {
      status: access.status === "unauthenticated" ? 401 : 403,
      body: { error: "Operator access required" },
    };
  let runtime: BetaWorkflowRuntime | undefined;
  try {
    const body = bodySchema.parse(input.body);
    const { tenantId, userId } = access.context;
    // Same caller request ID is isolated by tenant and client.
    const runId = fingerprint([tenantId, input.clientId, body.requestId]);
    runtime = await (input.loadRuntime ?? createBetaWorkflowRuntime)();
    const result =
      body.operation === "start"
        ? await runtime.start({
            tenantId,
            clientId: input.clientId,
            leadScore: body.leadScore,
            requestedBy: userId,
            correlationId: runId,
            workflowRunId: runId,
          })
        : body.operation === "resume"
          ? await runtime.resume(tenantId, input.clientId, runId)
          : await runtime.inspect(tenantId, input.clientId, runId);
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ZodError)
      return {
        status: 400,
        body: {
          error: "Invalid private beta request or non-synthetic contact",
        },
      };
    if (error instanceof WorkflowConflictError)
      return { status: 409, body: { error: error.message } };
    if (error instanceof Error && error.message.includes("not found"))
      return { status: 404, body: { error: "Not found for tenant" } };
    throw error;
  } finally {
    await runtime?.close();
  }
};
