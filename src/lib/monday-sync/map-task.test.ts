import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/tasks/schemas";
import {
  mapAgencyTaskToMonday,
  mapMondayToAgencyTaskPatch,
} from "./map-task";

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  tenantId: "tenant-a",
  projectId: "project-1",
  title: "Draft homepage",
  description: "Agency scope",
  status: "todo",
  assignee: "alice@agency.test",
  mondayItemId: null,
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  ...overrides,
});

describe("mapAgencyTaskToMonday", () => {
  it("maps status, assignee, and AgencyOS-owned title/description for outbound", () => {
    expect(mapAgencyTaskToMonday(baseTask({ status: "in_progress" }))).toEqual({
      title: "Draft homepage",
      description: "Agency scope",
      status: "working_on_it",
      assignee: "alice@agency.test",
    });
  });

  it("maps done and null assignee", () => {
    expect(
      mapAgencyTaskToMonday(baseTask({ status: "done", assignee: null })),
    ).toEqual({
      title: "Draft homepage",
      description: "Agency scope",
      status: "done",
      assignee: null,
    });
  });
});

describe("mapMondayToAgencyTaskPatch", () => {
  it("applies only status and assignee from Monday", () => {
    const result = mapMondayToAgencyTaskPatch({
      id: "mon-1",
      title: "Draft homepage",
      description: "Agency scope",
      status: "working_on_it",
      assignee: "bob@agency.test",
    });

    expect(result).toEqual({
      patch: { status: "in_progress", assignee: "bob@agency.test" },
      rejectedFields: [],
    });
  });

  it("rejects title/description edits from Monday and ignores them in the patch", () => {
    const result = mapMondayToAgencyTaskPatch(
      {
        id: "mon-1",
        title: "Hijacked title",
        description: "Hijacked description",
        status: "done",
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
    const result = mapMondayToAgencyTaskPatch(
      {
        id: "mon-1",
        title: "Draft homepage",
        description: "Agency scope",
        status: "not_started",
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
