import { describe, expect, it } from "vitest";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryUatService, UatStateError } from "./uat-service";

describe("uat service", () => {
  it("completes checklist items and signs off without e-sign vendors", async () => {
    const clients = createClientService(createInMemoryClientRepository());
    const projects = createProjectService(
      createInMemoryProjectRepository(),
      clients,
      createInMemoryBudgetAlertRepository(),
    );
    const uat = createInMemoryUatService({ projects });
    const client = await clients.create({ tenantId: "t1", name: "Acme" });
    const project = await projects.create({
      tenantId: "t1",
      clientId: client.id,
      name: "Site",
      budget: 1000,
      timelineStart: "2026-01-01",
      timelineEnd: "2026-02-01",
    });

    const checklist = await uat.createChecklist({
      tenantId: "t1",
      projectId: project.id,
      labels: ["Login works", "Billing page loads"],
    });

    await expect(
      uat.signOff({
        tenantId: "t1",
        projectId: project.id,
        actorId: "user-client",
      }),
    ).rejects.toBeInstanceOf(UatStateError);

    for (const item of checklist.items) {
      await uat.completeItem({
        tenantId: "t1",
        projectId: project.id,
        itemId: item.id,
        actorId: "user-client",
      });
    }

    const signed = await uat.signOff({
      tenantId: "t1",
      projectId: project.id,
      actorId: "user-client",
    });

    expect(signed.signedOffAt).toBeTruthy();
    expect(signed.signedOffBy).toBe("user-client");
  });
});
