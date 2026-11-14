import { describe, expect, it, vi } from "vitest";
import { SEED_CLIENT_ID } from "./seed-users";
import type { AuthSession } from "./session-context";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryChangeRequestRepository } from "@/lib/change-requests/change-request-repository";
import { createChangeRequestService } from "@/lib/change-requests/change-request-service";
import { handleDecideChangeRequest } from "@/lib/change-requests/change-requests-api";
import { createInMemoryDesignReviewRepository } from "@/lib/design-reviews/design-review-repository";
import { createDesignReviewService } from "@/lib/design-reviews/design-review-service";
import { handleDecideDesignReview } from "@/lib/design-reviews/design-reviews-api";
import type { Project } from "@/lib/projects/schemas";

const tenantId = "tenant-default";
const session = (role: string): AuthSession => ({ user: { id: role === "client" ? "user-client" : "synthetic-operator", role, tenantId } });
const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(createInMemoryProjectRepository(), clients, createInMemoryBudgetAlertRepository());
  const makeProject = async (tenantId: string, clientId?: string) => {
    const client = await clients.create({ tenantId, ...(clientId ? { id: clientId } : {}), name: "Synthetic client" });
    return projects.create({ tenantId, clientId: client.id, name: "Synthetic project", budget: 100, timelineStart: "2026-01-01", timelineEnd: "2026-02-01" });
  };
  const owned = await makeProject(tenantId, SEED_CLIENT_ID);
  const other = await makeProject(tenantId);
  const otherTenant = await makeProject("tenant-other");
  const changes = createInMemoryChangeRequestRepository();
  const reviews = createInMemoryDesignReviewRepository();
  const changeService = createChangeRequestService({ changeRequests: changes, projects });
  const reviewService = createDesignReviewService({ reviews, projects });
  const createChange = (project: Project, decidingRole = "client") => changeService.create({
    tenantId: project.tenantId, projectId: project.id, title: "Synthetic scope", scopeImpact: "One page", timelineImpact: "One day", budgetImpact: 10, createdBy: "synthetic-author", createdByRole: decidingRole === "client" ? "agency" : "client",
  });
  const createReview = (project: Project) => reviewService.create({ tenantId: project.tenantId, projectId: project.id, title: "Synthetic review", assetUrl: "https://example.com/synthetic.png" });
  return { projects, owned, other, otherTenant, changes, reviews, changeService, reviewService, createChange, createReview };
};

describe.each(["approve", "reject"] as const)("project-scoped %s decisions", (decision) => {
  it.each(["client", "admin", "agent-operator"])("does not mutate another project's change request as %s", async (role) => {
    const ctx = await setup();
    const change = await ctx.createChange(ctx.other, role);
    const before = structuredClone(change);
    const update = vi.spyOn(ctx.changes, "update");
    const result = await handleDecideChangeRequest({ session: session(role), service: ctx.changeService, projects: ctx.projects, projectId: ctx.owned.id, changeRequestId: change.id, body: { decision } });
    expect(update).not.toHaveBeenCalled();
    expect(await ctx.changes.getByTenantAndId(tenantId, change.id)).toEqual(before);
    expect(result).toEqual({ status: 404, body: { error: "Change request not found" } });
  });

  it("does not mutate another client's design review before returning 404", async () => {
    const ctx = await setup();
    const review = await ctx.createReview(ctx.other);
    const before = structuredClone(review);
    const update = vi.spyOn(ctx.reviews, "update");
    const result = await handleDecideDesignReview({ session: session("client"), service: ctx.reviewService, projects: ctx.projects, projectId: ctx.owned.id, reviewId: review.id, body: { decision, annotation: "Should not be saved" } });
    expect(update).not.toHaveBeenCalled();
    expect(await ctx.reviews.getByTenantAndId(tenantId, review.id)).toEqual(before);
    expect(result).toEqual({ status: 404, body: { error: "Design review not found" } });
  });

  it.each(["client", "admin", "agent-operator"])("still permits %s to decide a correctly scoped change request", async (role) => {
    const ctx = await setup();
    const change = await ctx.createChange(ctx.owned, role);
    const update = vi.spyOn(ctx.changes, "update");
    const result = await handleDecideChangeRequest({ session: session(role), service: ctx.changeService, projects: ctx.projects, projectId: ctx.owned.id, changeRequestId: change.id, body: { decision } });
    expect(result.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(await ctx.changes.getByTenantAndId(tenantId, change.id)).toMatchObject({ status: decision === "approve" ? "approved" : "rejected" });
  });

  it("still permits a client to decide their correctly scoped review", async () => {
    const ctx = await setup();
    const review = await ctx.createReview(ctx.owned);
    const update = vi.spyOn(ctx.reviews, "update");
    const result = await handleDecideDesignReview({ session: session("client"), service: ctx.reviewService, projects: ctx.projects, projectId: ctx.owned.id, reviewId: review.id, body: { decision } });
    expect(result.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(await ctx.reviews.getByTenantAndId(tenantId, review.id)).toMatchObject({ status: decision === "approve" ? "approved" : "rejected" });
  });

  it("still denies an unowned URL project before either decision service can mutate", async () => {
    const ctx = await setup();
    const change = await ctx.createChange(ctx.other);
    const review = await ctx.createReview(ctx.other);
    const changeUpdate = vi.spyOn(ctx.changes, "update");
    const reviewUpdate = vi.spyOn(ctx.reviews, "update");
    const changeResult = await handleDecideChangeRequest({ session: session("client"), service: ctx.changeService, projects: ctx.projects, projectId: ctx.other.id, changeRequestId: change.id, body: { decision } });
    const reviewResult = await handleDecideDesignReview({ session: session("client"), service: ctx.reviewService, projects: ctx.projects, projectId: ctx.other.id, reviewId: review.id, body: { decision } });
    expect(changeResult).toEqual({ status: 404, body: { error: "Project not found" } });
    expect(reviewResult).toEqual({ status: 404, body: { error: "Project not found" } });
    expect(changeUpdate).not.toHaveBeenCalled();
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it("preserves tenant isolation for both decision types", async () => {
    const ctx = await setup();
    const change = await ctx.createChange(ctx.otherTenant);
    const review = await ctx.createReview(ctx.otherTenant);
    const changeUpdate = vi.spyOn(ctx.changes, "update");
    const reviewUpdate = vi.spyOn(ctx.reviews, "update");
    const changeResult = await handleDecideChangeRequest({ session: session("client"), service: ctx.changeService, projects: ctx.projects, projectId: ctx.owned.id, changeRequestId: change.id, body: { decision } });
    const reviewResult = await handleDecideDesignReview({ session: session("client"), service: ctx.reviewService, projects: ctx.projects, projectId: ctx.owned.id, reviewId: review.id, body: { decision } });
    expect(changeResult).toEqual({ status: 404, body: { error: "Change request not found" } });
    expect(reviewResult).toEqual({ status: 404, body: { error: "Design review not found" } });
    expect(changeUpdate).not.toHaveBeenCalled();
    expect(reviewUpdate).not.toHaveBeenCalled();
  });
});
