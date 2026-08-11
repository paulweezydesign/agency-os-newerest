import { describe, expect, it } from "vitest";
import { createInMemoryAgentActionLogRepository } from "@/lib/agent-action-logs/agent-action-log-repository";
import { createInMemoryClientRepository } from "@/lib/clients/client-repository";
import { createClientService } from "@/lib/clients/client-service";
import { createInMemoryBudgetAlertRepository } from "@/lib/projects/budget-alert-repository";
import { createInMemoryProjectRepository } from "@/lib/projects/project-repository";
import { createProjectService } from "@/lib/projects/project-service";
import { createInMemoryTaskRepository } from "@/lib/tasks/task-repository";
import { createTaskService } from "@/lib/tasks/task-service";
import { createInMemoryLinearClient } from "./linear-client";
import { createInMemorySyncLogRepository } from "./sync-log-repository";
import { syncTaskToLinear } from "./push-task-to-linear";
import { withLinearTaskSync } from "./with-linear-task-sync";

describe("withLinearTaskSync", () => {
  it("pushes create and status/assignee updates to Linear", async () => {
    const clients = createClientService(createInMemoryClientRepository());
    const projects = createProjectService(
      createInMemoryProjectRepository(),
      clients,
      createInMemoryBudgetAlertRepository(),
    );
    const taskRepo = createInMemoryTaskRepository();
    const linear = createInMemoryLinearClient();
    const syncLogs = createInMemorySyncLogRepository();
    const base = createTaskService(
      taskRepo,
      projects,
      createInMemoryAgentActionLogRepository(),
    );
    const tasks = withLinearTaskSync(
      base,
      syncTaskToLinear({ tasks: taskRepo, linear, syncLogs }),
    );

    const client = await clients.create({
      tenantId: "tenant-a",
      name: "Acme",
    });
    const project = await projects.create({
      tenantId: "tenant-a",
      clientId: client.id,
      name: "Site",
      budget: 1000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-10-01",
    });

    const created = await tasks.create({
      tenantId: "tenant-a",
      projectId: project.id,
      title: "Task A",
      assignee: "alice@agency.test",
      correlationId: "c1",
      actorName: "agent-operator",
    });

    expect(created.linearIssueId).toBe("lin-1");
    expect(linear.issues.get("lin-1")).toMatchObject({
      status: "unstarted",
      assignee: "alice@agency.test",
    });

    const updated = await tasks.update({
      tenantId: "tenant-a",
      taskId: created.id,
      status: "done",
      assignee: "bob@agency.test",
      correlationId: "c2",
      actorName: "agent-operator",
    });

    expect(updated.linearIssueId).toBe("lin-1");
    expect(linear.issues.get("lin-1")).toMatchObject({
      status: "completed",
      assignee: "bob@agency.test",
    });
  });
});
