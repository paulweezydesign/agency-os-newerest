import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/tasks/schemas";
import {
  mapAgencyTaskToLinear,
  mapLinearToAgencyTaskPatch,
} from "./map-task";

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  tenantId: "tenant-a",
  projectId: "project-1",
  title: "Draft homepage",
  description: "Agency scope",
  status: "todo",
  assignee: "alice@agency.test",
  linearIssueId: null,
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  ...overrides,
});

describe("mapAgencyTaskToLinear", () => {
  it("maps status, assignee, and AgencyOS-owned title/description for outbound", () => {
    expect(mapAgencyTaskToLinear(baseTask({ status: "in_progress" }))).toEqual({
      title: "Draft homepage",
      description: "Agency scope",
      status: "started",
      assignee: "alice@agency.test",
    });
  });

  it("maps done to completed and null assignee", () => {
    expect(
      mapAgencyTaskToLinear(baseTask({ status: "done", assignee: null })),
    ).toEqual({
      title: "Draft homepage",
      description: "Agency scope",
      status: "completed",
      assignee: null,
    });
  });
});

describe("mapLinearToAgencyTaskPatch", () => {
  it("applies only status and assignee from Linear", () => {
    const result = mapLinearToAgencyTaskPatch({
      id: "lin-1",
      title: "Draft homepage",
      description: "Agency scope",
      status: "started",
      assignee: "bob@agency.test",
    });

    expect(result).toEqual({
      patch: { status: "in_progress", assignee: "bob@agency.test" },
      rejectedFields: [],
    });
  });

  it("rejects title/description edits from Linear and ignores them in the patch", () => {
    const result = mapLinearToAgencyTaskPatch(
      {
        id: "lin-1",
        title: "Hijacked title",
        description: "Hijacked description",
        status: "completed",
        assignee: null,
      },
      {
        title: "Draft homepage",
        description: "Agency scope",
      },
    );

    expect(result.patch).toEqual({ status: "done", assignee: null });
    expect(result.rejectedFields).toEqual(["title", "description"]);
  });

  it("does not reject title/description when they match AgencyOS", () => {
    const result = mapLinearToAgencyTaskPatch(
      {
        id: "lin-1",
        title: "Draft homepage",
        description: "Agency scope",
        status: "unstarted",
        assignee: "alice@agency.test",
      },
      {
        title: "Draft homepage",
        description: "Agency scope",
      },
    );

    expect(result.rejectedFields).toEqual([]);
    expect(result.patch).toEqual({
      status: "todo",
      assignee: "alice@agency.test",
    });
  });
});
