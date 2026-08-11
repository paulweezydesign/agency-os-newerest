import { describe, expect, it } from "vitest";
import { SEED_CLIENT_ID } from "@/lib/auth/seed-users";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryFigmaClient } from "@/lib/figma/figma-client";
import { createInMemoryDesignReviewRepository } from "./design-review-repository";
import { createDesignReviewService } from "./design-review-service";
import {
  handleCreateDesignReview,
  handleDecideDesignReview,
} from "./design-reviews-api";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const figma = createInMemoryFigmaClient();
  figma.seedFile({ key: "AbCdEf123", name: "Portal Frame" });
  const service = createDesignReviewService({
    reviews: createInMemoryDesignReviewRepository(),
    projects,
    figma,
  });
  await clients.create({
    tenantId: "tenant-default",
    id: SEED_CLIENT_ID,
    name: "Acme",
  });
  const project = await projects.create({
    tenantId: "tenant-default",
    clientId: SEED_CLIENT_ID,
    name: "Portal Project",
    budget: 1000,
    timelineStart: "2026-01-01",
    timelineEnd: "2026-02-01",
  });
  return { service, projects, project };
};

describe("design-reviews-api", () => {
  it("lets operators create reviews and clients approve", async () => {
    const { service, projects, project } = await setup();

    const created = await handleCreateDesignReview({
      session: {
        user: {
          id: "user-operator",
          role: "agent-operator",
          tenantId: "tenant-default",
        },
      },
      service,
      projectId: project.id,
      body: {
        title: "Hero",
        assetUrl: "https://cdn.example.com/hero.png",
      },
    });
    expect(created.status).toBe(201);

    const decided = await handleDecideDesignReview({
      session: {
        user: {
          id: "user-client",
          role: "client",
          tenantId: "tenant-default",
        },
      },
      service,
      projects,
      projectId: project.id,
      reviewId: created.status === 201 ? created.body.id : "",
      body: { decision: "approve", annotation: "Looks good" },
    });

    expect(decided.status).toBe(200);
    if (decided.status === 200) {
      expect(decided.body.status).toBe("approved");
    }
  });

  it("forbids operators from client decide path", async () => {
    const { service, projects, project } = await setup();
    const created = await handleCreateDesignReview({
      session: {
        user: {
          id: "user-operator",
          role: "agent-operator",
          tenantId: "tenant-default",
        },
      },
      service,
      projectId: project.id,
      body: {
        title: "Hero",
        assetUrl: "https://cdn.example.com/hero.png",
      },
    });

    const decided = await handleDecideDesignReview({
      session: {
        user: {
          id: "user-operator",
          role: "agent-operator",
          tenantId: "tenant-default",
        },
      },
      service,
      projects,
      projectId: project.id,
      reviewId: created.status === 201 ? created.body.id : "",
      body: { decision: "approve" },
    });

    expect(decided.status).toBe(403);
  });

  it("lets operators create Figma-backed reviews clients can approve", async () => {
    const { service, projects, project } = await setup();

    const created = await handleCreateDesignReview({
      session: {
        user: {
          id: "user-operator",
          role: "agent-operator",
          tenantId: "tenant-default",
        },
      },
      service,
      projectId: project.id,
      body: {
        title: "Figma hero",
        figmaUrl: "https://www.figma.com/file/AbCdEf123/Hero",
      },
    });
    expect(created.status).toBe(201);
    if (created.status === 201) {
      expect(created.body.figmaFileName).toBe("Portal Frame");
    }

    const decided = await handleDecideDesignReview({
      session: {
        user: {
          id: "user-client",
          role: "client",
          tenantId: "tenant-default",
        },
      },
      service,
      projects,
      projectId: project.id,
      reviewId: created.status === 201 ? created.body.id : "",
      body: { decision: "reject", annotation: "Needs contrast" },
    });

    expect(decided.status).toBe(200);
    if (decided.status === 200) {
      expect(decided.body.status).toBe("rejected");
    }
  });
});
