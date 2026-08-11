import { describe, expect, it } from "vitest";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryDesignReviewRepository } from "./design-review-repository";
import {
  createDesignReviewService,
  DesignReviewStateError,
} from "./design-review-service";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const reviews = createDesignReviewService({
    reviews: createInMemoryDesignReviewRepository(),
    projects,
  });
  const client = await clients.create({ tenantId: "t1", name: "Acme" });
  const project = await projects.create({
    tenantId: "t1",
    clientId: client.id,
    name: "Site",
    budget: 1000,
    timelineStart: "2026-01-01",
    timelineEnd: "2026-02-01",
  });
  return { reviews, project };
};

describe("design review service", () => {
  it("creates, annotates, and approves a review", async () => {
    const { reviews, project } = await setup();

    const created = await reviews.create({
      tenantId: "t1",
      projectId: project.id,
      title: "Homepage",
      assetUrl: "https://cdn.example.com/home.png",
    });
    expect(created.status).toBe("pending");

    const annotated = await reviews.annotate({
      tenantId: "t1",
      reviewId: created.id,
      annotation: "Tighten spacing",
    });
    expect(annotated.status).toBe("annotated");

    const approved = await reviews.decide({
      tenantId: "t1",
      reviewId: created.id,
      decision: "approve",
      decidedBy: "user-client",
    });
    expect(approved.status).toBe("approved");
    expect(approved.decidedBy).toBe("user-client");
  });

  it("rejects after approval is blocked", async () => {
    const { reviews, project } = await setup();
    const created = await reviews.create({
      tenantId: "t1",
      projectId: project.id,
      title: "Logo",
      assetUrl: "https://cdn.example.com/logo.png",
    });
    await reviews.decide({
      tenantId: "t1",
      reviewId: created.id,
      decision: "reject",
      decidedBy: "user-client",
      annotation: "Wrong palette",
    });

    await expect(
      reviews.decide({
        tenantId: "t1",
        reviewId: created.id,
        decision: "approve",
        decidedBy: "user-client",
      }),
    ).rejects.toBeInstanceOf(DesignReviewStateError);
  });
});
