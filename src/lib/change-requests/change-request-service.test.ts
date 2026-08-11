import { describe, expect, it } from "vitest";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryChangeRequestRepository } from "./change-request-repository";
import { createChangeRequestService } from "./change-request-service";

const setup = async () => {
  const clients = createClientService(createInMemoryClientRepository());
  const projects = createProjectService(
    createInMemoryProjectRepository(),
    clients,
    createInMemoryBudgetAlertRepository(),
  );
  const changeRequests = createChangeRequestService({
    changeRequests: createInMemoryChangeRequestRepository(),
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
  return { changeRequests, project };
};

describe("change request service", () => {
  it("creates agency CR pending client and approves via client", async () => {
    const { changeRequests, project } = await setup();

    const created = await changeRequests.create({
      tenantId: "t1",
      projectId: project.id,
      title: "Add blog",
      scopeImpact: "New section",
      timelineImpact: "+1 week",
      budgetImpact: 1500,
      createdBy: "operator",
      createdByRole: "agency",
    });

    expect(created.status).toBe("pending_client");

    const approved = await changeRequests.decide({
      tenantId: "t1",
      changeRequestId: created.id,
      decision: "approve",
      actorId: "user-client",
      actorRole: "client",
    });

    expect(approved.status).toBe("approved");
    expect(approved.clientApprovedBy).toBe("user-client");
  });
});
