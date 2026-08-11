import { describe, expect, it } from "vitest";
import { createInMemoryClientRepository } from "./client-repository";
import { createClientService } from "./client-service";

describe("createClientService", () => {
  it("creates a client scoped to the given tenantId", async () => {
    const service = createClientService(createInMemoryClientRepository());

    const created = await service.create({
      tenantId: "tenant-a",
      name: "Acme Co",
    });

    expect(created).toMatchObject({
      tenantId: "tenant-a",
      name: "Acme Co",
    });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();
  });

  it("lists only clients for the requested tenant", async () => {
    const service = createClientService(createInMemoryClientRepository());

    await service.create({ tenantId: "tenant-a", name: "Acme Co" });
    await service.create({ tenantId: "tenant-b", name: "Other Org" });

    const listed = await service.list("tenant-a");

    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Acme Co");
    expect(listed[0]?.tenantId).toBe("tenant-a");
  });

  it("gets a client by id within the same tenant", async () => {
    const service = createClientService(createInMemoryClientRepository());
    const created = await service.create({
      tenantId: "tenant-a",
      name: "Acme Co",
    });

    const found = await service.get("tenant-a", created.id);

    expect(found).toEqual(created);
  });

  it("returns null when getting a client from another tenant", async () => {
    const service = createClientService(createInMemoryClientRepository());
    const created = await service.create({
      tenantId: "tenant-a",
      name: "Acme Co",
    });

    const found = await service.get("tenant-b", created.id);

    expect(found).toBeNull();
  });
});
