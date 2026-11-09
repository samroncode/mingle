import { beforeEach, describe, expect, it, vi } from "vitest";

const logError = vi.fn();
vi.mock("@/api/log", () => ({
  logError: (e: unknown): void => void logError(e),
}));

import { loadChunk } from "./loadView";

describe("loadChunk", () => {
  beforeEach(() => logError.mockClear());

  it("returns the loaded module without logging", async () => {
    await expect(loadChunk(() => Promise.resolve("ok"))).resolves.toBe("ok");
    expect(logError).not.toHaveBeenCalled();
  });

  it("logs a code only and rethrows when the chunk fails to load", async () => {
    const failure = new Error(
      "Failed to fetch https://x/assets/a.js#key=secret",
    );
    await expect(loadChunk(() => Promise.reject(failure))).rejects.toBe(
      failure,
    );
    expect(logError).toHaveBeenCalledWith({
      area: "router",
      action: "load_chunk",
      code: "chunk_load_failed",
    });
  });
});
