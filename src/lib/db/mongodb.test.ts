import { afterEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const connection = { readyState: 0 };

vi.mock("mongoose", () => ({
  default: {
    connect: connectMock,
    connection,
  },
}));

describe("connectMongo", () => {
  afterEach(() => {
    vi.resetModules();
    connectMock.mockReset();
    connection.readyState = 0;
    delete process.env.MONGODB_URI;
  });

  it("connects with MONGODB_URI and reports ready", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/agencyos-test";
    connectMock.mockImplementation(async () => {
      connection.readyState = 1;
      return undefined;
    });

    const { connectMongo } = await import("./mongodb");
    const result = await connectMongo();

    expect(connectMock).toHaveBeenCalledWith(
      "mongodb://localhost:27017/agencyos-test",
    );
    expect(result).toEqual({ ready: true });
  });

  it("reuses an existing ready connection without calling connect again", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/agencyos-test";
    connection.readyState = 1;

    const { connectMongo } = await import("./mongodb");
    const result = await connectMongo();

    expect(connectMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ready: true });
  });

  it("throws when MONGODB_URI is missing", async () => {
    const { connectMongo } = await import("./mongodb");

    await expect(connectMongo()).rejects.toThrow(/MONGODB_URI/);
  });
});
