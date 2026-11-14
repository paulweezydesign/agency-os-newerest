import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createInMemorySyncLogRepository as createLinearLogs } from "@/lib/linear/sync-log-repository";
import { createInMemorySyncLogRepository as createMondayLogs } from "@/lib/monday-sync/sync-log-repository";
import { createInMemoryStripeClient } from "@/lib/stripe/stripe-client";

const factories = vi.hoisted(() => ({
  unavailable: new Error("Synthetic storage unavailable"),
  linear: vi.fn(), monday: vi.fn(), deposits: vi.fn(), stripe: vi.fn(),
}));
vi.mock("@/lib/linear/get-linear-runtime", () => ({ getLinearRuntime: factories.linear }));
vi.mock("@/lib/monday-sync/get-monday-runtime", () => ({ getMondayRuntime: factories.monday }));
vi.mock("@/lib/stripe/get-deposit-service", () => ({ getDepositService: factories.deposits }));
vi.mock("@/lib/stripe/get-stripe-client", () => ({ getStripeClient: factories.stripe }));

import { POST as linearPost } from "./linear/route";
import { POST as mondayPost } from "./monday/route";
import { POST as stripePost } from "./stripe/route";

const trackerBody = (status: string) => ({ action: "update", data: { id: "synthetic-tracker-id", title: "Synthetic task", description: "Synthetic description", status, assignee: "synthetic-assignee" } });
const stripeBody = () => ({ id: "evt_synthetic", type: "checkout.session.completed", data: { object: { id: "cs_synthetic", amount_total: 25, currency: "usd", metadata: { tenantId: "tenant-synthetic", projectId: "project-synthetic" } } } });
const request = (body: unknown, signature = "whsec_test") => new Request("http://localhost/api/webhooks/test", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature }, body: JSON.stringify(body) });
const routes = [
  { name: "Linear", post: linearPost, body: () => trackerBody("started") },
  { name: "Monday", post: mondayPost, body: () => trackerBody("working_on_it") },
  { name: "Stripe", post: stripePost, body: stripeBody },
];
const expectNoFactories = () => {
  expect(factories.linear).not.toHaveBeenCalled();
  expect(factories.monday).not.toHaveBeenCalled();
  expect(factories.deposits).not.toHaveBeenCalled();
  expect(factories.stripe).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
  for (const factory of [factories.linear, factories.monday, factories.deposits]) {
    factory.mockImplementation(() => { throw factories.unavailable; });
  }
  factories.stripe.mockReturnValue(createInMemoryStripeClient());
});
afterEach(() => vi.unstubAllEnvs());

describe.each(routes)("$name synthetic-only webhook", (route) => {
  it.each([
    { label: "production", node: "production", vercel: undefined, vercelEnv: undefined },
    { label: "Vercel production", node: "production", vercel: "1", vercelEnv: "production" },
    { label: "Preview with development NODE_ENV", node: "development", vercel: undefined, vercelEnv: "preview" },
    { label: "Vercel with no tier", node: "development", vercel: "1", vercelEnv: undefined },
    { label: "Vercel development", node: "development", vercel: undefined, vercelEnv: "development" },
    { label: "Preview with test NODE_ENV", node: "test", vercel: undefined, vercelEnv: "preview" },
    { label: "unspecified runtime", node: undefined, vercel: undefined, vercelEnv: undefined },
    { label: "unknown runtime", node: "staging", vercel: undefined, vercelEnv: undefined },
  ])("fails closed in $label before parsing or initialization", async ({ node, vercel, vercelEnv }) => {
    vi.stubEnv("NODE_ENV", node);
    vi.stubEnv("VERCEL", vercel);
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    const incoming = request(route.body());
    const readJson = vi.spyOn(incoming, "json");
    const readText = vi.spyOn(incoming, "text");
    const response = await route.post(incoming);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Live webhooks are not configured" });
    expectNoFactories();
    expect(readJson).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  });
});

const trackers = [
  { name: "Linear", post: linearPost, factory: factories.linear, createLogs: createLinearLogs, link: "linearIssueId", status: "started" },
  { name: "Monday", post: mondayPost, factory: factories.monday, createLogs: createMondayLogs, link: "mondayItemId", status: "working_on_it" },
];
describe.each(trackers)("$name payload before storage", (route) => {
  it.each([{}, { action: "update", data: {} }, trackerBody("unsupported")])("rejects invalid payload %j without storage", async (body) => {
    const response = await route.post(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid webhook payload" });
    expectNoFactories();
  });
  it("rejects malformed JSON without storage", async () => {
    const response = await route.post(new Request("http://localhost/webhook", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid webhook payload" });
    expectNoFactories();
  });
  it.each(["test", "development"])("preserves valid synthetic updates in %s", async (node) => {
    vi.stubEnv("NODE_ENV", node);
    const tasks = createInMemoryTaskRepository();
    const syncLogs = route.createLogs();
    const task = await tasks.create({ tenantId: "tenant-synthetic", projectId: "project-synthetic", title: "Synthetic task", description: "Synthetic description", status: "todo", assignee: null, [route.link]: "synthetic-tracker-id" });
    route.factory.mockResolvedValue({ tasks, syncLogs });
    const response = await route.post(request(trackerBody(route.status)));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "success", taskId: task.id });
    expect(route.factory).toHaveBeenCalledTimes(1);
    expect(await tasks.getByTenantAndId("tenant-synthetic", task.id)).toMatchObject({ status: "in_progress", assignee: "synthetic-assignee" });
    expect(await syncLogs.listByTenant("tenant-synthetic")).toHaveLength(1);
  });
  it("does not hide storage failures for valid input", async () => {
    await expect(route.post(request(trackerBody(route.status)))).rejects.toBe(factories.unavailable);
    expect(route.factory).toHaveBeenCalledTimes(1);
  });
});

describe("Stripe verification before deposit storage", () => {
  it.each(["", "wrong"])("rejects signature %j without storage", async (signature) => {
    const response = await stripePost(request(stripeBody(), signature));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid webhook signature" });
    expect(factories.deposits).not.toHaveBeenCalled();
  });
  it("rejects an unsupported test event without storage", async () => {
    const response = await stripePost(request({ ...stripeBody(), type: "synthetic.unsupported" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unsupported event type: synthetic.unsupported" });
    expect(factories.deposits).not.toHaveBeenCalled();
  });
  it.each(["projectId", "tenantId", "amount_total"])("rejects invalid %s without storage", async (field) => {
    const body = stripeBody();
    if (field === "amount_total") body.data.object.amount_total = 0;
    else body.data.object.metadata[field as "projectId" | "tenantId"] = "";
    const response = await stripePost(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid checkout metadata" });
    expect(factories.deposits).not.toHaveBeenCalled();
  });
  it.each(["test", "development"])("preserves a verified synthetic deposit in %s", async (node) => {
    vi.stubEnv("NODE_ENV", node);
    const applyCheckoutCompleted = vi.fn().mockResolvedValue({ projectId: "project-synthetic", depositTotal: 25 });
    const stripe = createInMemoryStripeClient();
    const verify = vi.spyOn(stripe, "constructWebhookEvent");
    factories.stripe.mockReturnValue(stripe);
    factories.deposits.mockImplementation(async () => {
      expect(verify).toHaveBeenCalledTimes(1);
      return { applyCheckoutCompleted };
    });
    const response = await stripePost(request(stripeBody()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, projectId: "project-synthetic", depositTotal: 25 });
    expect(factories.deposits).toHaveBeenCalledTimes(1);
    expect(applyCheckoutCompleted).toHaveBeenCalledExactlyOnceWith({ tenantId: "tenant-synthetic", projectId: "project-synthetic", amount: 25, sessionId: "cs_synthetic" });
  });
  it("does not hide storage failures for a verified event", async () => {
    await expect(stripePost(request(stripeBody()))).rejects.toBe(factories.unavailable);
    expect(factories.deposits).toHaveBeenCalledTimes(1);
  });
});
