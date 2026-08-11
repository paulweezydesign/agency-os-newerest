import { afterEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const findMock = vi.fn();
const findOneMock = vi.fn();
const sortMock = vi.fn();
const execMock = vi.fn();

vi.mock("./client-model", () => ({
  getClientModel: () => ({
    create: createMock,
    find: findMock,
    findOne: findOneMock,
  }),
}));

describe("createMongooseClientRepository", () => {
  afterEach(() => {
    vi.resetModules();
    createMock.mockReset();
    findMock.mockReset();
    findOneMock.mockReset();
    sortMock.mockReset();
    execMock.mockReset();
  });

  it("creates and maps a tenant-scoped client document", async () => {
    const createdAt = new Date("2026-08-11T00:00:00.000Z");
    createMock.mockResolvedValue({
      _id: { toString: () => "507f1f77bcf86cd799439011" },
      tenantId: "tenant-default",
      name: "Acme Co",
      createdAt,
    });

    const { createMongooseClientRepository } = await import(
      "./mongoose-client-repository"
    );
    const repository = createMongooseClientRepository();
    const client = await repository.create({
      tenantId: "tenant-default",
      name: "Acme Co",
    });

    expect(createMock).toHaveBeenCalledWith({
      tenantId: "tenant-default",
      name: "Acme Co",
      contactEmail: undefined,
      pipelineStage: "lead",
      leadScore: 0,
    });
    expect(client).toEqual({
      id: "507f1f77bcf86cd799439011",
      tenantId: "tenant-default",
      name: "Acme Co",
      contactEmail: undefined,
      pipelineStage: "lead",
      leadScore: 0,
      createdAt: "2026-08-11T00:00:00.000Z",
    });
  });

  it("lists clients filtered by tenantId", async () => {
    execMock.mockResolvedValue([
      {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        tenantId: "tenant-default",
        name: "Acme Co",
        createdAt: new Date("2026-08-11T00:00:00.000Z"),
      },
    ]);
    sortMock.mockReturnValue({ exec: execMock });
    findMock.mockReturnValue({ sort: sortMock });

    const { createMongooseClientRepository } = await import(
      "./mongoose-client-repository"
    );
    const repository = createMongooseClientRepository();
    const clients = await repository.listByTenant("tenant-default");

    expect(findMock).toHaveBeenCalledWith({ tenantId: "tenant-default" });
    expect(clients).toHaveLength(1);
    expect(clients[0]?.name).toBe("Acme Co");
  });

  it("gets by tenant and id, returning null for invalid ids", async () => {
    findOneMock.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    const { createMongooseClientRepository } = await import(
      "./mongoose-client-repository"
    );
    const repository = createMongooseClientRepository();

    await expect(
      repository.getByTenantAndId("tenant-default", "not-an-object-id"),
    ).resolves.toBeNull();
    expect(findOneMock).not.toHaveBeenCalled();
  });
});
