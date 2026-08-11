export type FigmaFile = {
  key: string;
  name: string;
};

export type FigmaClient = {
  getFile: (input: { fileKey: string }) => Promise<FigmaFile>;
};

export class FigmaClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaClientError";
  }
}

const FIGMA_FILE_KEY =
  /^https:\/\/(?:www\.)?figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/;

export const parseFigmaFileKey = (figmaUrl: string): string => {
  const match = FIGMA_FILE_KEY.exec(figmaUrl.trim());
  if (!match) {
    throw new FigmaClientError(
      `Invalid Figma URL "${figmaUrl}". Expected https://www.figma.com/file/<key>/... or /design/<key>/...`,
    );
  }
  return match[1]!;
};

export type InMemoryFigmaClient = FigmaClient & {
  files: Map<string, FigmaFile>;
  seedFile: (file: FigmaFile) => void;
  failNext: (error?: string) => void;
  clear: () => void;
};

export const createInMemoryFigmaClient = (): InMemoryFigmaClient => {
  const files = new Map<string, FigmaFile>();
  let nextError: string | null = null;

  return {
    files,
    seedFile: (file) => {
      files.set(file.key, file);
    },
    failNext: (error = "Figma unavailable") => {
      nextError = error;
    },
    clear: () => {
      files.clear();
      nextError = null;
    },
    getFile: async ({ fileKey }) => {
      if (nextError) {
        const error = nextError;
        nextError = null;
        throw new FigmaClientError(error);
      }

      const file = files.get(fileKey);
      if (!file) {
        throw new FigmaClientError(
          `Figma file "${fileKey}" was not found. Check the link and token access.`,
        );
      }
      return file;
    },
  };
};
