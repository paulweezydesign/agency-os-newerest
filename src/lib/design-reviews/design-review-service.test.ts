import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryFigmaClient } from "@/lib/figma/figma-client";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryDesignReviewRepository } from "./design-review-repository";
import {
  createDesignReviewService,
  DesignReviewStateError,
  FigmaAttachError,
} from "./design-review-service";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const figma = createInMemoryFigmaClient();
  figma.seedFile({ key: "AbCdEf123", name: "Homepage Frame" });
  const actionLogs = createInMemoryAgentActionLogRepository();
  const reviews = createDesignReviewService({
    reviews: createInMemoryDesignReviewRepository(),
    projects,
    figma,
    actionLogs,
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
  return { reviews, project, figma, actionLogs };
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

  it("attaches a Figma deep-link and still supports approve", async () => {
    const { reviews, project } = await setup();

    const created = await reviews.create({
      tenantId: "t1",
      projectId: project.id,
      title: "Figma homepage",
      figmaUrl: "https://www.figma.com/file/AbCdEf123/Homepage",
      correlationId: "corr-figma-1",
    });

    expect(created.figmaFileKey).toBe("AbCdEf123");
    expect(created.figmaFileName).toBe("Homepage Frame");
    expect(created.assetUrl).toBe(
      "https://www.figma.com/file/AbCdEf123/Homepage",
    );

    const approved = await reviews.decide({
      tenantId: "t1",
      reviewId: created.id,
      decision: "approve",
      decidedBy: "user-client",
    });
    expect(approved.status).toBe("approved");
  });

  it("logs actionable errors when Figma attach fails", async () => {
    const { reviews, project, figma, actionLogs } = await setup();
    figma.failNext("Figma rate limited");

    await expect(
      reviews.create({
        tenantId: "t1",
        projectId: project.id,
        title: "Broken Figma",
        figmaUrl: "https://www.figma.com/design/AbCdEf123/Broken",
        correlationId: "corr-figma-fail",
      }),
    ).rejects.toBeInstanceOf(FigmaAttachError);

    const logs = await actionLogs.listByCorrelationId("t1", "corr-figma-fail");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("error");
    expect(logs[0]?.toolName).toBe("figma.getFile");
  });
});
