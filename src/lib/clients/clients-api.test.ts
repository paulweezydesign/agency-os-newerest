import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/session-context";
import { createInMemoryClientRepository } from "./client-repository";
import { createClientService } from "./client-service";
import {
  handleCreateClient,
  handleGetClient,
  handleListClients,
} from "./clients-api";

const operatorSession: AuthSession = {
  user: {
    id: "user-operator",
    role: "agent-operator",
    tenantId: "tenant-default",
  },
};

const clientRoleSession: AuthSession = {
  user: {
    id: "user-client",
    role: "client",
    tenantId: "tenant-default",
  },
};

const createDeps = () => {
  const service = createClientService(createInMemoryClientRepository());
  return { service };
};

describe("clients API handlers", () => {
  it("allows an operator to create and list clients for their tenant", async () => {
    const { service } = createDeps();

    const created = await handleCreateClient({
      session: operatorSession,
      service,
      body: { name: "Acme Co" },
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      tenantId: "tenant-default",
      name: "Acme Co",
    });

    const listed = await handleListClients({
      session: operatorSession,
      service,
    });

    expect(listed.status).toBe(200);
    if (listed.status !== 200) {
      throw new Error("expected list success");
    }
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ name: "Acme Co" });
  });

  it("allows an operator to get a client by id", async () => {
    const { service } = createDeps();
    const created = await handleCreateClient({
      session: operatorSession,
      service,
      body: { name: "Acme Co" },
    });

    const clientId =
      created.status === 201 && created.body && "id" in created.body
        ? created.body.id
        : "";

    const result = await handleGetClient({
      session: operatorSession,
      service,
      clientId,
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      id: clientId,
      name: "Acme Co",
    });
  });

  it("rejects unauthenticated create/list/get", async () => {
    const { service } = createDeps();

    const created = await handleCreateClient({
      session: null,
      service,
      body: { name: "Acme Co" },
    });
    const listed = await handleListClients({ session: null, service });
    const got = await handleGetClient({
      session: null,
      service,
      clientId: "missing",
    });

    expect(created).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
    expect(listed).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
    expect(got).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("rejects client-role access to create/list/get", async () => {
    const { service } = createDeps();

    const created = await handleCreateClient({
      session: clientRoleSession,
      service,
      body: { name: "Acme Co" },
    });
    const listed = await handleListClients({
      session: clientRoleSession,
      service,
    });
    const got = await handleGetClient({
      session: clientRoleSession,
      service,
      clientId: "missing",
    });

    expect(created).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
    expect(listed).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
    expect(got).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("returns 404 when an operator requests a missing client", async () => {
    const { service } = createDeps();

    const result = await handleGetClient({
      session: operatorSession,
      service,
      clientId: "does-not-exist",
    });

    expect(result).toEqual({
      status: 404,
      body: { error: "Not found" },
    });
  });
});
