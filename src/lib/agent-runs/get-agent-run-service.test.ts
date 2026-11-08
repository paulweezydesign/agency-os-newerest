import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ connect: vi.fn(), repository: vi.fn(), generator: vi.fn(), service: vi.fn() }));
vi.mock("@/lib/db/mongodb", () => ({ connectMongo: mocks.connect }));
vi.mock("./mongoose-agent-run-repository", () => ({ createMongooseAgentRunRepository: mocks.repository }));
vi.mock("./openai-bounded-generator", () => ({ createOpenAIBoundedGenerator: mocks.generator }));
vi.mock("./agent-run-service", () => ({ createAgentRunService: mocks.service }));
import { getAgentRunService } from "./get-agent-run-service";

beforeEach(() => vi.clearAllMocks());
describe("bounded service composition", () => {
  it("does not connect Mongo when provider configuration is unavailable", async () => {
    mocks.generator.mockRejectedValueOnce(new Error("disabled"));
    await expect(getAgentRunService()).rejects.toThrow("disabled");
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.repository).not.toHaveBeenCalled();
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("composes only the durable repository and bounded generator", async () => {
    const generator = { modelId: "openai/gpt-6-astra" };
    const repository = { inspect: vi.fn() };
    const service = { start: vi.fn() };
    mocks.generator.mockResolvedValueOnce(generator);
    mocks.repository.mockReturnValueOnce(repository);
    mocks.service.mockReturnValueOnce(service);
    expect(await getAgentRunService()).toBe(service);
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.service).toHaveBeenCalledExactlyOnceWith(repository, generator);
  });
});
