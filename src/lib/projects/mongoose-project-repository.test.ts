import { afterEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const findMock = vi.fn();
const findOneMock = vi.fn();
const findOneAndUpdateMock = vi.fn();

vi.mock("./project-model", () => ({
  getProjectModel: () => ({
    create: createMock,
    find: findMock,
    findOne: findOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
  }),
}));

describe("createMongooseProjectRepository", () => {
  afterEach(() => {
    vi.resetModules();
    createMock.mockReset();
    findMock.mockReset();
    findOneMock.mockReset();
    findOneAndUpdateMock.mockReset();
  });

  it("maps created mongoose docs to Project records", async () => {
    createMock.mockResolvedValue({
      _id: { toString: () => "507f1f77bcf86cd799439011" },
      tenantId: "tenant-a",
      clientId: "client-1",
      name: "Website redesign",
      budget: 25000,
      spend: 0,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
      createdAt: new Date("2026-08-11T00:00:00.000Z"),
    });

    const { createMongooseProjectRepository } = await import(
      "./mongoose-project-repository"
    );
    const repository = createMongooseProjectRepository();
    const created = await repository.create({
      tenantId: "tenant-a",
      clientId: "client-1",
      name: "Website redesign",
      budget: 25000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
    });

    expect(createMock).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      clientId: "client-1",
      name: "Website redesign",
      budget: 25000,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
      spend: 0,
    });
    expect(created).toEqual({
      id: "507f1f77bcf86cd799439011",
      tenantId: "tenant-a",
      clientId: "client-1",
      name: "Website redesign",
      budget: 25000,
      spend: 0,
      timelineStart: "2026-09-01",
      timelineEnd: "2026-12-01",
      createdAt: "2026-08-11T00:00:00.000Z",
    });
  });

  it("lists by tenantId and clientId", async () => {
    findMock.mockReturnValue({
      sort: () => ({
        exec: async () => [],
      }),
    });

    const { createMongooseProjectRepository } = await import(
      "./mongoose-project-repository"
    );
    const repository = createMongooseProjectRepository();
    await repository.listByTenantAndClient("tenant-a", "client-1");

    expect(findMock).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      clientId: "client-1",
    });
  });

  it("skips findOne for invalid ObjectIds", async () => {
    const { createMongooseProjectRepository } = await import(
      "./mongoose-project-repository"
    );
    const repository = createMongooseProjectRepository();
    const found = await repository.getByTenantAndId(
      "tenant-a",
      "not-an-object-id",
    );

    expect(found).toBeNull();
    expect(findOneMock).not.toHaveBeenCalled();
  });
});
