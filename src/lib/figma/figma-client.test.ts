import { describe, expect, it } from "vitest";
import {
  createInMemoryFigmaClient,
  FigmaClientError,
  parseFigmaFileKey,
} from "./figma-client";

describe("parseFigmaFileKey", () => {
  it("extracts keys from file and design URLs", () => {
    expect(
      parseFigmaFileKey("https://www.figma.com/file/AbCdEf123/Homepage"),
    ).toBe("AbCdEf123");
    expect(
      parseFigmaFileKey(
        "https://www.figma.com/design/XyZ987/Checkout?node-id=1-2",
      ),
    ).toBe("XyZ987");
  });

  it("rejects non-Figma URLs", () => {
    expect(() => parseFigmaFileKey("https://cdn.example.com/a.png")).toThrow(
      FigmaClientError,
    );
  });
});

describe("in-memory Figma client", () => {
  it("returns file metadata for known keys", async () => {
    const figma = createInMemoryFigmaClient();
    figma.seedFile({ key: "AbCdEf123", name: "Homepage" });

    const file = await figma.getFile({ fileKey: "AbCdEf123" });
    expect(file).toEqual({ key: "AbCdEf123", name: "Homepage" });
  });

  it("fails with an actionable error when Figma is unavailable", async () => {
    const figma = createInMemoryFigmaClient();
    figma.failNext("Figma rate limited");

    await expect(figma.getFile({ fileKey: "missing" })).rejects.toThrow(
      /Figma rate limited/,
    );
  });
});
