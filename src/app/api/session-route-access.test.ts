import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import type { AuthSession } from "@/lib/auth/session-context";
import { SEED_CLIENT_ID } from "@/lib/auth/seed-users";

const factories = vi.hoisted(() => {
  const unavailable = new Error("Storage is unavailable");
  const initialize = vi.fn((): unknown => { throw unavailable; });
  return { unavailable, initialize };
});
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/clients/get-client-service", () => ({ getClientService: factories.initialize }));
vi.mock("@/lib/projects/get-project-service", () => ({ getProjectService: factories.initialize }));
vi.mock("@/lib/tasks/get-task-service", () => ({ getTaskService: factories.initialize }));
vi.mock("@/lib/client-pipeline/get-client-pipeline-service", () => ({ getClientPipelineService: factories.initialize }));
vi.mock("@/lib/policy-gates/get-policy-gate-service", () => ({ getPolicyGateService: factories.initialize }));
vi.mock("@/lib/project-artifacts/get-artifact-service", () => ({ getArtifactService: factories.initialize }));
vi.mock("@/lib/change-requests/get-change-request-service", () => ({ getChangeRequestService: factories.initialize }));
vi.mock("@/lib/design-reviews/get-design-review-service", () => ({ getDesignReviewService: factories.initialize }));
vi.mock("@/lib/stripe/get-deposit-service", () => ({ getDepositService: factories.initialize }));
vi.mock("@/lib/linear/get-linear-runtime", () => ({ getLinearRuntime: factories.initialize }));
vi.mock("@/lib/monday-sync/get-monday-runtime", () => ({ getMondayRuntime: factories.initialize }));
vi.mock("@/lib/uat/get-uat-service", () => ({ getUatService: factories.initialize }));
vi.mock("@/lib/agents/get-project-manager-agent", () => ({ getProjectManagerAgent: factories.initialize }));
vi.mock("@/lib/agents/get-teammate-agent", () => ({ getTeammateAgent: factories.initialize }));
vi.mock("@/lib/agents/get-spawned-teammate-agent", () => ({ getSpawnedTeammateAgent: factories.initialize }));

import * as clients from "./clients/route";
import * as client from "./clients/[clientId]/route";
import * as clientProjects from "./clients/[clientId]/projects/route";
import * as pipeline from "./clients/[clientId]/pipeline/route";
import * as gates from "./policy-gates/route";
import * as gateDecision from "./policy-gates/[gateId]/decision/route";
import * as linearLogs from "./sync-logs/route";
import * as mondayLogs from "./monday-sync-logs/route";
import * as project from "./projects/[projectId]/route";
import * as artifacts from "./projects/[projectId]/artifacts/route";
import * as sendSow from "./projects/[projectId]/artifacts/send-sow/route";
import * as budgetAlerts from "./projects/[projectId]/budget-alerts/route";
import * as changeRequests from "./projects/[projectId]/change-requests/route";
import * as changeDecision from "./projects/[projectId]/change-requests/[changeRequestId]/decision/route";
import * as deposits from "./projects/[projectId]/deposits/route";
import * as designReviews from "./projects/[projectId]/design-reviews/route";
import * as designDecision from "./projects/[projectId]/design-reviews/[reviewId]/decision/route";
import * as github from "./projects/[projectId]/github/route";
import * as spend from "./projects/[projectId]/spend/route";
import * as tasks from "./projects/[projectId]/tasks/route";
import * as task from "./tasks/[taskId]/route";
import * as uat from "./projects/[projectId]/uat/route";
import * as signOff from "./projects/[projectId]/uat/sign-off/route";
import * as chat from "./agents/[name]/chat/route";

type Access = "operator" | "portal" | "operator-or-portal";
type RouteParams = { clientId: string; projectId: string; gateId: string; changeRequestId: string; reviewId: string; taskId: string; name: string };
type Route = {
  label: string;
  method: "GET" | "POST" | "PATCH";
  handler: (request: Request, context: { params: Promise<RouteParams> }) => Promise<Response>;
  access: Access;
  name?: string;
};
const routes: Route[] = [
  { label: "/clients GET", method: "GET", handler: clients.GET, access: "operator" },
  { label: "/clients POST", method: "POST", handler: clients.POST, access: "operator" },
  { label: "/clients/:id GET", method: "GET", handler: client.GET, access: "operator" },
  { label: "/clients/:id/projects GET", method: "GET", handler: clientProjects.GET, access: "operator" },
  { label: "/clients/:id/projects POST", method: "POST", handler: clientProjects.POST, access: "operator" },
  { label: "/clients/:id/pipeline POST", method: "POST", handler: pipeline.POST, access: "operator" },
  { label: "/policy-gates GET", method: "GET", handler: gates.GET, access: "operator" },
  { label: "/policy-gates POST", method: "POST", handler: gates.POST, access: "operator" },
  { label: "/policy-gates/:id/decision POST", method: "POST", handler: gateDecision.POST, access: "operator" },
  { label: "/sync-logs GET", method: "GET", handler: linearLogs.GET, access: "operator" },
  { label: "/monday-sync-logs GET", method: "GET", handler: mondayLogs.GET, access: "operator" },
  { label: "/projects/:id GET", method: "GET", handler: project.GET, access: "operator" },
  { label: "/projects/:id/artifacts GET", method: "GET", handler: artifacts.GET, access: "operator" },
  { label: "/projects/:id/artifacts POST", method: "POST", handler: artifacts.POST, access: "operator" },
  { label: "/projects/:id/artifacts/send-sow POST", method: "POST", handler: sendSow.POST, access: "operator" },
  { label: "/projects/:id/budget-alerts GET", method: "GET", handler: budgetAlerts.GET, access: "operator" },
  { label: "/projects/:id/change-requests POST", method: "POST", handler: changeRequests.POST, access: "operator-or-portal" },
  { label: "/projects/:id/change-requests/:id/decision POST", method: "POST", handler: changeDecision.POST, access: "operator-or-portal" },
  { label: "/projects/:id/deposits POST", method: "POST", handler: deposits.POST, access: "operator" },
  { label: "/projects/:id/design-reviews GET", method: "GET", handler: designReviews.GET, access: "operator-or-portal" },
  { label: "/projects/:id/design-reviews POST", method: "POST", handler: designReviews.POST, access: "operator" },
  { label: "/projects/:id/design-reviews/:id/decision POST", method: "POST", handler: designDecision.POST, access: "portal" },
  { label: "/projects/:id/github POST", method: "POST", handler: github.POST, access: "operator" },
  { label: "/projects/:id/spend POST", method: "POST", handler: spend.POST, access: "operator" },
  { label: "/projects/:id/tasks GET", method: "GET", handler: tasks.GET, access: "operator" },
  { label: "/projects/:id/tasks POST", method: "POST", handler: tasks.POST, access: "operator" },
  { label: "/tasks/:id PATCH", method: "PATCH", handler: task.PATCH, access: "operator" },
  { label: "/projects/:id/uat GET", method: "GET", handler: uat.GET, access: "operator-or-portal" },
  { label: "/projects/:id/uat POST", method: "POST", handler: uat.POST, access: "operator" },
  { label: "/projects/:id/uat/sign-off POST", method: "POST", handler: signOff.POST, access: "portal" },
  { label: "/agents/project-manager/chat POST", method: "POST", handler: chat.POST, access: "operator", name: "project-manager" },
  { label: "/agents/research/chat POST", method: "POST", handler: chat.POST, access: "operator", name: "research" },
  { label: "/agents/spawned:synthetic/chat POST", method: "POST", handler: chat.POST, access: "operator", name: "spawned:synthetic" },
];
const session = (role: string, id = "synthetic-user"): AuthSession => ({ user: { id, role, tenantId: "tenant-synthetic" } });
const call = (route: Route, body: unknown = { decision: "approve", labels: ["Synthetic check"] }) => route.handler(
  new Request("http://localhost/api/test", {
    method: route.method,
    ...(route.method === "GET" ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  }),
  { params: Promise.resolve({ clientId: "client-synthetic", projectId: "project-synthetic", gateId: "gate-synthetic", changeRequestId: "change-synthetic", reviewId: "review-synthetic", taskId: "task-synthetic", name: route.name ?? "project-manager" }) },
);
const setSession = (value: AuthSession) => vi.mocked(auth).mockResolvedValue(value as never);

beforeEach(() => {
  vi.clearAllMocks();
  factories.initialize.mockImplementation(() => { throw factories.unavailable; });
});

describe.each(routes)("$label authorizes before storage", (route) => {
  it("returns 401 without initializing storage for an anonymous caller", async () => {
    setSession(null);
    const response = await call(route);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(factories.initialize).not.toHaveBeenCalled();
  });
  it("returns 403 without initializing storage for an unsupported role", async () => {
    setSession(session("viewer"));
    const response = await call(route);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(factories.initialize).not.toHaveBeenCalled();
  });
  it("preserves client-role access and seed-link requirements", async () => {
    setSession(session("client", "user-client"));
    if (route.access === "operator") {
      const response = await call(route);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Forbidden" });
      expect(factories.initialize).not.toHaveBeenCalled();
    } else {
      await expect(call(route)).rejects.toBe(factories.unavailable);
      expect(factories.initialize).toHaveBeenCalled();
      factories.initialize.mockClear();
      setSession(session("client", "unlinked-client"));
      const response = await call(route);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(factories.initialize).not.toHaveBeenCalled();
    }
  });
  it.each(["admin", "agent-operator"])("preserves %s access", async (role) => {
    setSession(session(role));
    if (route.access === "portal") {
      const response = await call(route);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Forbidden" });
      expect(factories.initialize).not.toHaveBeenCalled();
    } else {
      await expect(call(route)).rejects.toBe(factories.unavailable);
      expect(factories.initialize).toHaveBeenCalled();
    }
  });
});

it("preserves successful client-list responses and the authenticated tenant", async () => {
  setSession(session("agent-operator"));
  const list = vi.fn().mockResolvedValue([{ id: "client-synthetic" }]);
  factories.initialize.mockReturnValue({ list });
  const response = await clients.GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([{ id: "client-synthetic" }]);
  expect(list).toHaveBeenCalledWith("tenant-synthetic");
});

it("preserves unknown agent names as 404 without initializing an agent", async () => {
  setSession(null);
  const response = await call({ label: "unknown", method: "POST", handler: chat.POST, access: "operator", name: "not-an-agent" });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Agent not found" });
  expect(factories.initialize).not.toHaveBeenCalled();
});

it("preserves change-request decision validation precedence without storage", async () => {
  setSession(null);
  const route = routes.find((candidate) => candidate.handler === changeDecision.POST)!;
  const response = await call(route, { decision: "invalid" });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid request" });
  expect(factories.initialize).not.toHaveBeenCalled();
});

it.each([
  ["design reviews", designReviews.GET, "GET"],
  ["design decision", designDecision.POST, "POST"],
  ["change requests", changeRequests.POST, "POST"],
  ["change decision", changeDecision.POST, "POST"],
  ["uat", uat.GET, "GET"],
  ["uat sign-off", signOff.POST, "POST"],
] as const)("preserves client ownership checks for %s", async (label, handler, method) => {
  setSession(session("client", "user-client"));
  const get = vi.fn().mockResolvedValue({ id: "project-synthetic", clientId: `${SEED_CLIENT_ID}-other` });
  const operation = vi.fn();
  factories.initialize.mockReturnValue({ get, create: operation, decide: operation, listByProject: operation, getByProject: operation, signOff: operation });
  const response = await call({ label, handler, method, access: "portal" });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Project not found" });
  expect(get).toHaveBeenCalledWith("tenant-synthetic", "project-synthetic");
  expect(operation).not.toHaveBeenCalled();
});
